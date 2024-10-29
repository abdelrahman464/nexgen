const asyncHandler = require('express-async-handler');
const Order = require('../models/orderModel');
const Course = require('../models/courseModel');
const Package = require('../models/packageModel');
const TeamProfit = require('../models/teamProfits');
const CoursePackage = require('../models/coursePackageModel');
const UserSubscription = require('../models/userSubscriptionModel');
const User = require('../models/userModel');
const Chat = require('../models/ChatModel');
const Notification = require('../models/notificationModel');
const CourseProgress = require('../models/courseProgressModel');
const { calculateProfits } = require('./marketingService');
const { availUserToReview } = require('./userService');

/** 
 i will write here some things that i may forget about business logic 
 1- i checked for instructor percentage in 'createCourse' function only , cause instructor don't own package or live --> line 226
*/
//** ==> helpers functions => i distribute the code to small functions to make it more readable and easy to maintain
async function createOrder(user, course, price, isPaid) {
  const order = await Order.create({
    user: user._id,
    course: course._id,
    totalOrderPrice: price,
    isPaid: isPaid,
    paymentMethodType: isPaid ? 'manual' : null,
    paidAt: isPaid ? Date.now() : null,
  });

  if (!order) throw new Error("Couldn't create order");
}

async function createCourseProgress(user, course) {
  await CourseProgress.create({
    user: user._id,
    course: course._id,
    progress: [],
  });
}

async function addUserToGroupChat(user, course) {
  const chat = await Chat.findOneAndUpdate(
    { course: course._id, isGroupChat: true },
    { $push: { participants: { user: user._id, isAdmin: false } } },
    { new: true },
  );
  //send notification
  await Notification.create({
    user: user._id,
    message: {
      en: `you has been added to the group ${chat.groupName}`,
      ar: `${chat.groupName} تمت اضافتك الى المجموعة `,
    },
    chat: chat._id,
    type: 'chat',
  });
}

async function subscribeUserToPackage(user, course) {
  const package = await Package.findOne({ course: course._id });
  if (package) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    const subscriptionDurationDays = 4 * 30; // 4 months
    endDate.setDate(startDate.getDate() + subscriptionDurationDays);
    return await UserSubscription.create({
      user: user._id,
      package: package._id,
      startDate,
      endDate,
    });
  }
}
//** ==> logical functions
//1
const createCoursePackageOrder = async (id, userId, isPaid) => {
  const coursePackage = await CoursePackage.findById(id);
  if (!coursePackage) throw new Error('CoursePackage not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const coursePackagePrice = coursePackage.priceAfterDiscount
    ? coursePackage.priceAfterDiscount
    : coursePackage.price;

  const order = await Order.create({
    user: user._id,
    coursePackage: coursePackage._id,
    totalOrderPrice: coursePackagePrice,
    isPaid: isPaid,
    paymentMethodType: isPaid ? 'manual' : null,
    paidAt: isPaid ? Date.now() : null,
  });

  if (!order) throw new Error("Couldn't create order");

  // Create progress for user for each course in the package and subscribe user to the package
  // and add user to group chat per course and send notification
  await Promise.all(
    coursePackage.courses.map(async (courseId) => {
      await CourseProgress.create({
        user: user._id,
        course: courseId,
        progress: [],
      });

      // Add user to group chat per course and send notification
      const chat = await Chat.findOneAndUpdate(
        { course: courseId, isGroupChat: true },
        { $push: { participants: { user: user._id, isAdmin: false } } },
        { new: true },
      );
      if (chat) {
        await Notification.create({
          user: user._id,
          message: {
            en: `${user.name} has been added to the group ${chat.groupName}`,
            ar: `${chat.groupName} تمت اضافتك الى المجموعة `,
          },
          chat: chat._id,
          type: 'chat',
        });
      }

      // Subscribe user to package related to the course
      const package = await Package.findOne({ course: courseId });
      if (package) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);
        await UserSubscription.create({
          user: user._id,
          package: package._id,
          startDate,
          endDate,
        });
      }
    }),
  );
  //avail user to review
  await availUserToReview(user._id);
  if (isPaid) {
    const data = {
      email: user.email,
      amount: coursePackagePrice,
      item: `Course Package: ${coursePackage.title}`,
    };
    //4) calculate profits
    await calculateProfits(data);
  }
  return true;
};
//2
const createPackageOrder = asyncHandler(async (id, userId, isPaid) => {
  const package = await Package.findById(id);
  if (!package) throw new Error('Package not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const packagePrice = package.priceAfterDiscount
    ? package.priceAfterDiscount
    : package.price;

  const order = await Order.create({
    user: user._id,
    package: package._id,
    totalOrderPrice: packagePrice,
    isPaid: isPaid,
    paymentMethodType: isPaid ? 'manual' : null,
    paidAt: isPaid ? Date.now() : null,
    // paypalOrderId: paypalOrderId  // Adding the PayPal order ID to the order document
  });

  if (!order) throw new Error("Couldn't create order");

  // 3) Create user subscription if not exist, and if it exists renew his subscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);

  const subscription = await UserSubscription.findOne({
    user: user._id,
    package: package._id,
  }).sort({ endDate: -1 });

  if (subscription) {
    // If a subscription exists, renew it by updating the endDate
    subscription.endDate = endDate;
    await subscription.save();
  }
  // Only create a new subscription if no existing subscription was found or renewed
  await UserSubscription.create({
    user: user._id,
    package: package._id,
    startDate,
    endDate,
  });
  //avail user to review
  await availUserToReview(user._id);
  //check if user paid for this package
  if (isPaid) {
    //4) calculate profits
    const data = {
      email: user.email,
      amount: packagePrice,
      item: `package: ${package.title}`,
    };
    await calculateProfits(data);
  }
  return true;
});
//3
const createCourseOrder = async (id, userId, isPaid) => {
  try {
    const [course, user] = await Promise.all([
      Course.findById(id),
      User.findById(userId),
    ]);
    const coursePrice = course.priceAfterDiscount
      ? course.priceAfterDiscount
      : course.price;

    await createOrder(user, course, coursePrice, isPaid);
    await createCourseProgress(user, course);
    await addUserToGroupChat(user, course);
    await subscribeUserToPackage(user, course);
    //avail user to review
    await availUserToReview(user._id);
    //check if user paid for this course
    if (isPaid) {
      let instructorId = null;
      if (course.instructorPercentage && course.instructorPercentage > 0) {
        instructorId = course.instructor;
      }
      await calculateProfits({
        email: user.email,
        amount: coursePrice,
        item: `Course: ${course.title}`,
        instructorId: instructorId,
      });
    }
  } catch (error) {
    throw new Error(error.message);
  }
};
//** ==> main function that i use in the route
exports.purchaseForUser = async (req, res, next) => {
  try {
    const { type, id, userId, isPaid } = req.body;
    console.log(req.body);
    if (type === 'course') {
      await createCourseOrder(id, userId, isPaid);
    } else if (type === 'package') {
      await createPackageOrder(id, userId, isPaid);
    } else if (type === 'coursePackage') {
      await createCoursePackageOrder(id, userId, isPaid);
    } else {
      throw new Error('Invalid order type');
    }
    res.status(200).json({
      status: 'success',
      message: 'Order created successfully',
    });
  } catch (error) {
    res.status(400).json({
      status: 'failed',
      message: error.message,
    });
  }
};

//----------------------------------------------

//@use => this function to calculate profits and distribute it to the team members

const calculateTeamProfits = async (totalProfit, dates) => {
  const desc = `Profits from ${dates.startDate} to ${dates.endDate}`;

  console.log('start calculate profits2');
  const teamProfits = await TeamProfit.create({
    totalProfit,
    marketing: (totalProfit * 0.52).toFixed(2),
    dawood: (totalProfit * 0.41).toFixed(2),

    artosh: ((totalProfit * 0.07) / 5).toFixed(2), //softwave developers
    gomaa: ((totalProfit * 0.07) / 5).toFixed(2),
    yousef: ((totalProfit * 0.07) / 5).toFixed(2),
    mostafa: ((totalProfit * 0.07) / 5).toFixed(2),
    awad: ((totalProfit * 0.07) / 5).toFixed(2),
    desc,
  });
  if (!teamProfits) throw new Error("Couldn't calculate profits");
  console.log('end calculate profits2');
  return true;
};

exports.distributeProfits = async (req, res) => {
  const orders = await Order.find({ isCalculated: false }).sort({
    createdAt: 1,
  });
  if (orders.length === 0)
    return res.status(404).json({ status: 'faild', msg: 'no orders' });
  const sales = orders.map((order) => order.totalOrderPrice);
  const totalSales = sales.reduce((acc, item) => acc + item, 0);
  const dates = {
    startDate: orders[0].paidAt,
    endDate: orders[orders.length - 1].paidAt,
  };
  console.log('start calculate profits');
  await calculateTeamProfits(totalSales, dates);
  //update isCalculated to true
  const orderIds = orders.map((order) => order._id);
  await Order.updateMany({ _id: { $in: orderIds } }, { isCalculated: true });

  res.status(200).json({
    status: 'success',
    totalSales,
  });
  // res.status(200).json({
  //   status: "success",
  //   data: {
  //     totalSales,
  //     sales,
  //     orders,
  //   },
  // });
};
