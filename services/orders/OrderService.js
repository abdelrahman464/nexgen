const factory = require('../handllerFactory');
const Order = require('../../models/orderModel');
const Course = require('../../models/courseModel');
const Package = require('../../models/packageModel');
const CoursePackage = require('../../models/coursePackageModel');
const UserSubscription = require('../../models/userSubscriptionModel');
const User = require('../../models/userModel');
const Chat = require('../../models/ChatModel');
const Notification = require('../../models/notificationModel');
const CourseProgress = require('../../models/courseProgressModel');
const { calculateProfits } = require('../marketingService');
const { availUserToReview } = require('../userService');

const filterOrders = async (req, res, next) => {
  const filterObject = {};
  const newQuery = { ...req.query };

  //1- if marketer or admin is trying to get specific user orders
  if (req.query.userId) {
    filterObject.user = req.query.userId;
    delete newQuery.userId;
  }
  //2- if the user is trying to get their own orders
  else if (req.user.role === 'user') {
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

async function createOrderIfNotExist(userId, itemId, price, method, itemType) {
  //to avoid duplication of orders
  const existingOrder = await Order.findOne({
    user: userId,
    [itemType]: itemId,
    paymentMethodType: method,
    //check if the order created from 1h
    createdAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) },
  });

  const isResale = await checkExistingPaidOrder(userId);

  if (!existingOrder) {
    await Order.create({
      user: userId,
      [itemType]: itemId,
      totalOrderPrice: price,
      isPaid: true,
      paymentMethodType: method,
      paidAt: Date.now(),
      isResale: isResale,
    });
  }
}

// Utility to create course progress if not already exists
async function createCourseProgressIfNotExist(userId, courseId) {
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
    { new: true },
  );

  if (chat) {
    await Notification.create({
      user: userId,
      message: {
        en: `You have been added to the group ${chat.groupName}`,
        ar: `تمت اضافتك الى المجموعة ${chat.groupName}`,
      },
      chat: chat._id,
      type: 'chat',
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
const createCourseOrderHandler = async (courseId, email, price, method) => {
  const [course, user] = await Promise.all([
    Course.findById(courseId),
    User.findOne({ email }),
  ]);
  if (!course || !user) throw new Error('Course or user not found');

  await createOrderIfNotExist(user._id, course._id, price, method, 'course');
  await createCourseProgressIfNotExist(user._id, course._id);
  await addUserToGroupChatAndNotify(user._id, course._id);

  if (course.subscriptionPackage) {
    await createOrUpdateSubscription(
      user._id,
      course.subscriptionPackage._id,
      5 * 30,
    ); // 5 months
  }

  await availUserToReview(user._id);
  await calculateProfits({
    email: user.email,
    amount: price,
    item: `Course: ${course.title}`,
    instructorId: course.instructorPercentage > 0 ? course.instructor : null,
  });
};

// Handler for creating a package order
const createPackageOrderHandler = async (packageId, email, price, method) => {
  const [package, user] = await Promise.all([
    Package.findById(packageId),
    User.findOne({ email }),
  ]);
  if (!package || !user) throw new Error('Package or user not found');

  await createOrderIfNotExist(user._id, package._id, price, method, 'package');
  await createOrUpdateSubscription(
    user._id,
    package._id,
    package.subscriptionDurationDays,
  );

  if (package.type === 'course' && package.course) {
    await createCourseProgressIfNotExist(user._id, package.course._id);
  }

  await availUserToReview(user._id);
  await calculateProfits({
    email: user.email,
    amount: price,
    item: `Package: ${package.title}`,
  });
};

// Handler for creating a course package order
const createCoursePackageOrderHandler = async (
  coursePackageId,
  email,
  price,
  method,
) => {
  const [coursePackage, user] = await Promise.all([
    CoursePackage.findById(coursePackageId),
    User.findOne({ email }),
  ]);
  if (!coursePackage || !user)
    throw new Error('CoursePackage or user not found');

  await createOrderIfNotExist(
    user._id,
    coursePackage._id,
    price,
    method,
    'coursePackage',
  );

  await Promise.all(
    coursePackage.courses.map(async (courseId) => {
      await createCourseProgressIfNotExist(user._id, courseId);
      await addUserToGroupChatAndNotify(user._id, courseId);

      const package = await Package.findOne({ course: courseId });
      if (package) {
        await createOrUpdateSubscription(user._id, package._id, 4 * 30); // 4 months
      }
    }),
  );

  await availUserToReview(user._id);
  await calculateProfits({
    email: user.email,
    amount: price,
    item: `Course Package: ${coursePackage.title}`,
  });
};

module.exports = {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
  filterOrders,
  findAllOrders,
  findSpecificOrder,
  checkExistingPaidOrder,
};
