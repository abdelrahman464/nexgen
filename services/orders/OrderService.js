const mongoose = require("mongoose");
const factory = require("../handllerFactory");
const Order = require("../../models/orderModel");
const Course = require("../../models/courseModel");
const Package = require("../../models/packageModel");
const CoursePackage = require("../../models/coursePackageModel");
const UserSubscription = require("../../models/userSubscriptionModel");
const User = require("../../models/userModel");
const Chat = require("../../models/ChatModel");
const Notification = require("../../models/notificationModel");
const CourseProgress = require("../../models/courseProgressModel");

const { calculateProfits } = require("../marketing/marketingService");
const { availUserToReview } = require("../userService");
const { sendEmail } = require("../../utils/sendEmail");
const { PDFGenerator } = require("../../utils/generatePdf");
const { incrementCouponUsedTimes } = require("../couponService");

const filterOrders = async (req, res, next) => {
  const filterObject = {};
  const newQuery = { ...req.query };

  //1- if marketer or admin is trying to get specific user orders
  if (req.query.userId) {
    filterObject.user = req.query.userId;
    delete newQuery.userId;
  }
  //2- if the user is trying to get their own orders
  else if (req.user.role === "user") {
    filterObject.user = req.user._id;
  }

  // Date filtering logic
  if (req.query.startDate && req.query.endDate) {
    filterObject.paidAt = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
    // Removing the keys from the query
    delete newQuery.startDate;
    delete newQuery.endDate;
  } else if (req.query.day) {
    const dayStart = new Date(req.query.day);
    const dayEnd = new Date(req.query.day);
    dayEnd.setUTCHours(23, 59, 59, 999); // Set to the end of the day

    filterObject.paidAt = {
      $gte: dayStart,
      $lte: dayEnd,
    };
    // Removing the key from the query
    delete newQuery.day;
  }

  req.filterObj = filterObject;
  // Reset query params
  req.query = newQuery;
  next();
};

const findAllOrders = factory.getALl(Order);
//@desc get specific orders
//@route GET /api/v1/orders/:orderId
//@access protected/
const findSpecificOrder = factory.getOne(Order);

// Utility to create order if it doesn’t already exist

const checkExistingPaidOrder = async (userId) => {
  const orders = await Order.find({ user: userId, isPaid: true });
  if (orders.length > 0) {
    return true;
  }
  return false;
};

async function createOrder(orderDetails) {
  const { userId, itemId, price, method, itemType, couponName } = orderDetails;
  //to avoid duplication of orders
  let order;
  let flag = false;
  order = await Order.findOne({
    user: userId,
    [itemType]: itemId,
    paymentMethodType: method,
    //check if the order created from 1h
    createdAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) },
  });

  const isResale = await checkExistingPaidOrder(userId);

  if (!order) {
    order = await Order.create({
      user: userId,
      [itemType]: itemId,
      totalOrderPrice: price,
      isPaid: true,
      paymentMethodType: method,
      paidAt: Date.now(),
      isResale: isResale,
      coupon: couponName,
    });
    flag = true;
  }
  if (flag) return order;
  return null;
}

// Utility to create course progress if not already exists
async function createCourseProgress(userId, courseId) {
  const existingProgress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });
  if (!existingProgress) {
    await CourseProgress.create({
      user: userId,
      course: courseId,
      progress: [],
    });
  }
}

// Utility to add user to group chat and send notification
async function addUserToGroupChatAndNotify(userId, courseId) {
  const chat = await Chat.findOneAndUpdate(
    { course: courseId, isGroupChat: true },
    { $addToSet: { participants: { user: userId, isAdmin: false } } },
    { new: true }
  );

  if (chat) {
    await Notification.create({
      user: userId,
      message: {
        en: `You have been added to the group ${chat.groupName}`,
        ar: `تمت اضافتك الى المجموعة ${chat.groupName}`,
      },
      chat: chat._id,
      type: "chat",
    });
  }
}
//Utility to kick user from group chat
async function kickUserFromGroupChat(userId, courseId) {
  const chat = await Chat.findOneAndUpdate(
    { course: courseId, isGroupChat: true },
    { $pull: { participants: { user: userId } } },
    { new: true }
  );
  if (chat) {
    await Notification.create({
      user: userId,
      message: {
        en: `You have been removed from the group ${chat.groupName}`,
        ar: `تمت ازالتك من المجموعة ${chat.groupName}`,
      },
      type: "system",
    });
  }
}

// Utility to create or update subscription for a user and package
async function createOrUpdateSubscription(userId, packageId, durationDays) {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + durationDays);

  const subscription = await UserSubscription.findOne({
    user: userId,
    package: packageId,
  }).sort({ endDate: -1 });

  if (subscription) {
    subscription.endDate = endDate;
    await makeSureUserInChat(packageId, userId);
    await subscription.save();
  } else {
    await UserSubscription.create({
      user: userId,
      package: packageId,
      startDate,
      endDate,
    });
  }
}

// Handler for creating a course order
const createCourseOrderHandler = async (paymentDetails) => {
  const { id, email, price, method, couponName } = paymentDetails;

  const [course, user, package] = await Promise.all([
    Course.findById(id),
    User.findOne({ email }),
    Package.findOne({ course: id }),
  ]);
  if (!course || !user) throw new Error("Course or user not found");
  const orderDetails = {
    userId: user._id,
    itemId: course._id,
    price,
    method,
    itemType: "course",
    couponName,
  };
  let order = await createOrder(orderDetails);

  if (order) {
    // Populate the necessary fields
    order = await order.populate([
      { path: "user", select: "_id name phone email" },
      { path: "course", select: "title -category" },
      { path: "coursePackage", select: "title" },
      { path: "package", select: "title" },
    ]);

    //increment usedTimes of coupon after successful payment
    if (couponName) {
      await incrementCouponUsedTimes(couponName);
    }

    await createCourseProgress(user._id, course._id);
    await addUserToGroupChatAndNotify(user._id, course._id);

    if (package.course) {
      await createOrUpdateSubscription(
        user._id,
        package._id, // package id
        4 * 30
      ); // 4 months
    }

    await availUserToReview(user._id);
    await calculateProfits({
      email: user.email,
      amount: price,
      date: order.createdAt,
      itemType: "course",
      item: course.title,
      order: order._id,
      instructorId: course.instructorPercentage > 0 ? course.instructor : null,
    });
    // Generate the PDF
    let pdfPath = await PDFGenerator.generateOrderPDF(order);
    pdfPath = pdfPath.replace("uploads/orders/", "");
    await Notification.create({
      user: user._id,
      message: {
        en: `You have successfully purchased the course ${course.title.en} click here to download the invoice`,
        ar: `لقد قمت بشراء الدورة ${course.title.ar} بنجاح اضغط هنا لتحميل الفاتورة`,
      },
      file: pdfPath,
      type: "order",
    });

    //  Send the email
    // try {
    //   await sendEmail({
    //     to: user.email,
    //     subject: 'Order Confirmation',
    //     html: htmlEmail({
    //       startDate: new Date(subscription.current_period_start * 1000),
    //       endDate: new Date(subscription.current_period_end * 1000),
    //       subscriptionDurationDays: package.subscriptionDurationDays,
    //       OrderPrice: session.amount_total / 100,
    //       orderId: order._id,
    //     }),
    //   });
    // } catch (err) {
    //   console.error('Error sending email', err);
    // }
  }
};
/**
 * @desc : this function do that => (create order , create subscription doc || update existing one)
 * @param {*} paymentDetails
 */
// Handler for creating a package order
const createPackageOrderHandler = async (paymentDetails) => {
  const { id, email, price, method, couponName } = paymentDetails;
  const [package, user] = await Promise.all([
    Package.findById(id),
    User.findOne({ email }),
  ]);
  if (!package || !user) throw new Error("Package or user not found");

  const orderDetails = {
    userId: user._id,
    itemId: package._id,
    price,
    method,
    itemType: "package",
    couponName,
  };

  let order = await createOrder(orderDetails);
  if (order) {
    // Populate the necessary fields
    order = await order.populate([
      { path: "user", select: "_id name phone email" },
      { path: "course", select: "title -category" },
      { path: "coursePackage", select: "title" },
      { path: "package", select: "title" },
    ]);
    //increment usedTimes of coupon after successful payment
    if (couponName) {
      await incrementCouponUsedTimes(couponName);
    }
    await createOrUpdateSubscription(
      user._id,
      package._id,
      package.subscriptionDurationDays
    );

    // if (package.type === 'course' && package.course) {
    //   await createCourseProgress(user._id, package.course._id);
    // }

    // await availUserToReview(user._id);
    await calculateProfits({
      email: user.email,
      amount: price,
      itemType: "package",
      order: order._id,
      item: package.title,
    });

    // Generate the PDF
    let pdfPath = await PDFGenerator.generateOrderPDF(order);
    pdfPath = pdfPath.replace("uploads/orders/", "");
    await Notification.create({
      user: user._id,
      message: {
        en: `You have successfully purchased the service ${package.title.en} click here to download the invoice`,
        ar: `لقد قمت بشراء الخدمه ${package.title.ar} بنجاح اضغط هنا لتحميل الفاتورة`,
      },
      file: pdfPath,
      type: "order",
    });
  }
};

// Handler for creating a course package order
const createCoursePackageOrderHandler = async (paymentDetails) => {
  const { id, email, price, method, couponName } = paymentDetails;
  const [coursePackage, user] = await Promise.all([
    CoursePackage.findById(id),
    User.findOne({ email }),
  ]);
  if (!coursePackage || !user)
    throw new Error("CoursePackage or user not found");

  const orderDetails = {
    userId: user._id,
    itemId: coursePackage._id,
    price,
    method,
    itemType: "coursePackage",
    couponName,
  };

  let order = await createOrder(orderDetails);

  if (order) {
    // Populate the necessary fields
    order = await order.populate([
      { path: "user", select: "_id name phone email" },
      { path: "course", select: "title -category" },
      { path: "coursePackage", select: "title" },
      { path: "package", select: "title" },
    ]);

    //increment usedTimes of coupon after successful payment
    if (couponName) {
      await incrementCouponUsedTimes(couponName);
    }

    await Promise.all(
      coursePackage.courses.map(async (courseId) => {
        await createCourseProgress(user._id, courseId);
        await addUserToGroupChatAndNotify(user._id, courseId);

        const package = await Package.findOne({ course: courseId });
        if (package) {
          await createOrUpdateSubscription(user._id, package._id, 5 * 30); // 5 months
        }
      })
    );

    await availUserToReview(user._id);
    await calculateProfits({
      email: user.email,
      amount: price,
      itemType: "coursePackage",
      order: order._id,
      item: coursePackage.title,
    });
    // Generate the PDF
    let pdfPath = await PDFGenerator.generateOrderPDF(order);
    pdfPath = pdfPath.replace("uploads/orders/", "");
    await Notification.create({
      user: user._id,
      message: {
        en: `You have successfully purchased the Package ${coursePackage.title.en} click here to download the invoice`,
        ar: `لقد قمت بشراء الباقه ${coursePackage.title.ar} بنجاح اضغط هنا لتحميل الفاتورة`,
      },
      file: pdfPath,
      type: "order",
    });
  }
};

// Get order statistics
// Route GET /api/v1/orders/statistics
const getOrderStatistics = async (req, res) => {
  try {
    // Build match object based on product type filter
    const matchStage = {};
    if (req.query.courseId) {
      matchStage.course = mongoose.Types.ObjectId(req.query.courseId);
    } else if (req.query.packageId) {
      matchStage.package = mongoose.Types.ObjectId(req.query.packageId);
    } else if (req.query.coursePackageId) {
      matchStage.coursePackage = mongoose.Types.ObjectId(
        req.query.coursePackageId
      );
    }

    // 1. Overall Statistics with optional filter
    const overallStats = await Order.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalOrderPrice" },
          paidOrders: {
            $sum: { $cond: ["$isPaid", 1, 0] },
          },
          unpaidOrders: {
            $sum: { $cond: ["$isPaid", 0, 1] },
          },
          resaleOrders: {
            $sum: { $cond: ["$isResale", 1, 0] },
          },
          averageOrderValue: { $avg: "$totalOrderPrice" },
        },
      },
    ]);

    // 2. Monthly Statistics with optional filter
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          paidAt: { $ne: null },
          ...matchStage,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidAt" },
            month: { $month: "$paidAt" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalOrderPrice" },
          paidOrders: {
            $sum: { $cond: ["$isPaid", 1, 0] },
          },
          resaleOrders: {
            $sum: { $cond: ["$isResale", 1, 0] },
          },
          averageOrderValue: { $avg: "$totalOrderPrice" },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 },
      },
    ]);

    // 3. Payment Methods Statistics with optional filter
    const paymentMethodStats = await Order.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: "$paymentMethodType",
          count: { $sum: 1 },
          revenue: { $sum: "$totalOrderPrice" },
        },
      },
    ]);

    // 4. Daily Statistics for current month with optional filter
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const dailyStats = await Order.aggregate([
      {
        $match: {
          paidAt: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
          ...matchStage,
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$paidAt" },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalOrderPrice" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // 5. Recent Orders with optional filter
    const recentOrders = await Order.find(matchStage)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name email")
      .populate("course", "title")
      .populate("package", "title")
      .populate("coursePackage", "title");

    // 6. Calculate Growth Rates
    // Using the already declared currentDate from above
    const currentMonth = currentDate.getMonth() + 1; // Adding 1 because getMonth() is 0-based
    const currentYear = currentDate.getFullYear();

    // Find current month's data
    const currentMonthData = monthlyStats.find(
      (stat) => stat._id.month === currentMonth && stat._id.year === currentYear
    ) || { orders: 0, revenue: 0 };

    // Calculate previous month considering year transition
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = currentYear - 1;
    }

    // Find previous month's data
    const previousMonthData = monthlyStats.find(
      (stat) =>
        stat._id.month === previousMonth && stat._id.year === previousYear
    ) || { orders: 0, revenue: 0 };

    const growthRate = {
      orderGrowth: `${
        // eslint-disable-next-line no-nested-ternary
        previousMonthData.orders === 0
          ? currentMonthData.orders > 0
            ? 100
            : 0
          : (
              ((currentMonthData.orders - previousMonthData.orders) /
                previousMonthData.orders) *
              100
            ).toFixed(1)
      }%`,
      revenueGrowth: `${
        // eslint-disable-next-line no-nested-ternary
        previousMonthData.revenue === 0
          ? currentMonthData.revenue > 0
            ? 100
            : 0
          : (
              ((currentMonthData.revenue - previousMonthData.revenue) /
                previousMonthData.revenue) *
              100
            ).toFixed(1)
      }%`,
    };

    // 7. Get Product Details if filter is applied
    let productDetails = null;
    if (req.query.courseId) {
      productDetails = await Course.findById(req.query.courseId).select(
        "title"
      );
    } else if (req.query.packageId) {
      productDetails = await Package.findById(req.query.packageId).select(
        "title"
      );
    } else if (req.query.coursePackageId) {
      productDetails = await CoursePackage.findById(
        req.query.coursePackageId
      ).select("title");
    }

    res.status(200).json({
      status: "success",
      data: {
        productDetails,
        overview: overallStats[0],
        monthlyStats,
        paymentMethods: paymentMethodStats,
        dailyStats,
        recentOrders,
        growthRate, //monthly growth rate
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};

// Get orders by specific month with optional product filter
const getOrdersByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      throw new Error("Please provide both month and year");
    }

    // Build match object based on product type filter
    const matchStage = {};
    if (req.query.courseId) {
      matchStage.course = mongoose.Types.ObjectId(req.query.courseId);
    } else if (req.query.packageId) {
      matchStage.package = mongoose.Types.ObjectId(req.query.packageId);
    } else if (req.query.coursePackageId) {
      matchStage.coursePackage = mongoose.Types.ObjectId(
        req.query.coursePackageId
      );
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const orders = await Order.find({
      paidAt: {
        $gte: startDate,
        $lte: endDate,
      },
      ...matchStage,
    }).sort({ paidAt: -1 });

    const stats = await Order.aggregate([
      {
        $match: {
          paidAt: {
            $gte: startDate,
            $lte: endDate,
          },
          ...matchStage,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalOrderPrice" },
          avgOrderValue: { $avg: "$totalOrderPrice" },
          paidOrders: {
            $sum: { $cond: ["$isPaid", 1, 0] },
          },
          resaleOrders: {
            $sum: { $cond: ["$isResale", 1, 0] },
          },
        },
      },
    ]);

    // Get Product Details if filter is applied
    let productDetails = null;
    if (req.query.courseId) {
      productDetails = await Course.findById(req.query.courseId).select(
        "title"
      );
    } else if (req.query.packageId) {
      productDetails = await Package.findById(req.query.packageId).select(
        "title"
      );
    } else if (req.query.coursePackageId) {
      productDetails = await CoursePackage.findById(
        req.query.coursePackageId
      ).select("title");
    }

    res.status(200).json({
      status: "success",
      data: {
        productDetails,
        monthStats: stats[0] || null,
        orders,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
};
//------------------
const makeSureUserInChat = async (packageId, userId) => {
  const package = await Package.findById(packageId).select("course");
  if (!package) {
    return;
  }
  const chat = await Chat.findOne({
    course: package.course._id,
    "participants.user": userId,
  }).select("_id");
  if (chat) {
    console.log("user already in chat");
    return;
  }
  await Chat.findOneAndUpdate(
    { course: package.course._id },
    {
      $addToSet: { participants: { user: userId } },
    }
  );
  return;
};

module.exports = {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
  filterOrders,
  findAllOrders,
  findSpecificOrder,
  checkExistingPaidOrder,
  getOrderStatistics,
  getOrdersByMonth,
  makeSureUserInChat,
};
