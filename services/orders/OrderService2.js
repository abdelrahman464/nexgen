const asyncHandler = require('express-async-handler');
const Order = require('../../models/orderModel');
const Course = require('../../models/courseModel');
const Package = require('../../models/packageModel');
const CoursePackage = require('../../models/coursePackageModel');
const UserSubscription = require('../../models/userSubscriptionModel');
const User = require('../../models/userModel');
const Chat = require('../../models/ChatModel');
const Notification = require('../../models/notificationModel');
const CourseProgress = require('../../models/courseProgressModel');
const { calculateProfits } = require('../marketing/marketingService');
const { availUserToReview } = require('../userService');
const { checkExistingPaidOrder } = require('./OrderService');
const { subscribeToFreePackage } = require('../userSubscriptionService');

/** 
 i will write here some things that i may forget about business logic 
 1- i checked for instructor percentage in 'createCourse' function only , cause instructor don't own package or live --> line 226
*/
//** ==> helpers functions => i distribute the code to small functions to make it more readable and easy to maintain

const checkSpecificOrderExistance = async (filter) => {
  const order = await Order.findOne(filter);
  if (order) return true;
  return false;
};

async function createOrder(userId, courseId, price, isPaid) {
  let isResale;
  if (isPaid) isResale = await checkExistingPaidOrder(userId);
  const order = await Order.create({
    user: userId,
    course: courseId,
    totalOrderPrice: price,
    isPaid: isPaid,
    isResale,
    paymentMethodType: isPaid ? 'manual' : null,
    paidAt: isPaid ? Date.now() : null,
  });
  if (!order) throw new Error("Couldn't create order");
  return order;
}

async function createCourseProgress(userId, courseId) {
  //check if user already have this course
  const courseProgress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });
  if (!courseProgress) {
    await CourseProgress.create({
      user: userId,
      course: courseId,
      progress: [],
    });
  }
}

async function addUserToGroupChat(userId, courseId) {
  const chat = await Chat.findOneAndUpdate(
    { course: courseId, isGroupChat: true },
    { $push: { participants: { user: userId, isAdmin: false } } },
    { new: true },
  );
  //send notification
  await Notification.create({
    user: userId,
    message: {
      en: `you has been added to the group ${chat.groupName}`,
      ar: `${chat.groupName} تمت اضافتك الى المجموعة `,
    },
    chat: chat._id,
    type: 'chat',
  });
}

async function subscribeUserToPackage(userId, courseId) {
  const package = await Package.findOne({ course: courseId });
  if (package) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    const subscriptionDurationDays = 4 * 30; // 4 months
    endDate.setDate(startDate.getDate() + subscriptionDurationDays);
    return await UserSubscription.create({
      user: userId,
      package: package._id,
      startDate,
      endDate,
    });
  }
}
//** ==> logical functions
//1
const createCoursePackageOrder = async (id, userId, isPaid) => {
  const result = await checkSpecificOrderExistance({
    user: userId,
    coursePackage: id,
  });
  if (result) throw new Error('Order already exists');
  const coursePackage = await CoursePackage.findById(id);
  if (!coursePackage) throw new Error('CoursePackage not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const coursePackagePrice = coursePackage.priceAfterDiscount
    ? coursePackage.priceAfterDiscount
    : coursePackage.price;

  let isResale;
  if (isPaid) isResale = await checkExistingPaidOrder(userId);
  const order = await Order.create({
    user: user._id,
    coursePackage: coursePackage._id,
    totalOrderPrice: coursePackagePrice,
    isPaid: isPaid,
    isResale,
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
      itemType: 'package',
      order: order._id,
      item: coursePackage.title,
    };
    //4) calculate profits
    await calculateProfits(data);
  }
  return true;
};
//2
const createPackageOrder = asyncHandler(async (id, userId, isPaid) => {
  const result = await checkSpecificOrderExistance({
    user: userId,
    package: id,
    endDate: { $gte: new Date() }, // Check if the package is still valid
  });
  if (result) throw new Error('Order already exists');
  const package = await Package.findById(id);
  if (!package) throw new Error('Package not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const packagePrice = package.priceAfterDiscount
    ? package.priceAfterDiscount
    : package.price;

  let isResale;
  if (isPaid) isResale = await checkExistingPaidOrder(userId);
  const order = await Order.create({
    user: user._id,
    package: package._id,
    totalOrderPrice: packagePrice,
    isPaid: isPaid,
    isResale,
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
  } else {
    // Only create a new subscription if no existing subscription was found or renewed
    await UserSubscription.create({
      user: user._id,
      package: package._id,
      startDate,
      endDate,
    });
    //if package type is course => let  gave course to user
    if (package.type === 'course') {
      await createCourseProgress(user._id, package.course._id);
    }

    //avail user to review
    await availUserToReview(user._id);
  }
  //check if user paid for this package
  if (isPaid) {
    //4) calculate profits
    const data = {
      email: user.email,
      amount: packagePrice,
      itemType: 'package',
      order: order._id,
      item: package.title,
    };
    await calculateProfits(data);
  }
  return true;
});
//3
const createCourseOrder = async (id, userId, isPaid) => {
  try {
    const result = await checkSpecificOrderExistance({
      user: userId,
      course: id,
    });
    if (result) throw new Error('Order already exists');
    const [course, user] = await Promise.all([
      Course.findById(id),
      User.findById(userId),
    ]);
    const coursePrice = course.priceAfterDiscount
      ? course.priceAfterDiscount
      : course.price;

    const order = await createOrder(user._id, course._id, coursePrice, isPaid);
    await createCourseProgress(user._id, course._id);
    await addUserToGroupChat(user._id, course._id);
    await subscribeUserToPackage(user._id, course._id);
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
        itemType: 'course',
        item: course.title,
        order: order._id,
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
//------------------------------------------------------------------------
exports.createUnPaidOrder = async (req, res, next) => {
  const { id: courseId } = req.params;
  const userId = req.user._id;
  try {
    const course = await Course.findById(courseId);
    if (!course) return next(new Error('Course not found'));
    if (course.price && course.price > 0)
      return next(new Error('Course is not free'));

    const result = await checkSpecificOrderExistance({
      user: userId,
      course: courseId,
    });
    if (result) return next(new Error('you already have this course'));
    await createOrder(userId, courseId, 0, false);
    await createCourseProgress(userId, courseId);
    await addUserToGroupChat(userId, courseId);
    await subscribeUserToPackage(userId, courseId);
    res.status(200).json({
      status: 'success',
      message: 'Order created successfully',
    });
  } catch (error) {
    next(new Error(error.message));
  }
};
