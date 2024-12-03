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

//   ============      Helpers     =================
// note : these helpers is used in create course function to apply single responsibility principle
// async function createOrder(userId, courseId, price, method) {
//   //check if user is having the course first
//   const existOrder = await Order.findOne({
//     user: userId,
//     course: courseId,
//     paymentMethodType: method,
//   });
//   if (!existOrder) {
//     await Order.create({
//       user: userId,
//       course: courseId,
//       totalOrderPrice: price,
//       isPaid: true,
//       paymentMethodType: method,
//       paidAt: Date.now(),
//     });
//   }
// }
// //------------

// async function createCourseProgress(userId, courseId) {
//   //check if user is having the course first
//   const existCourse = await CourseProgress.findOne({
//     user: userId,
//     course: courseId,
//   });
//   if (!existCourse) {
//     //create course progress
//     await CourseProgress.create({
//       user: userId,
//       course: courseId,
//       progress: [],
//     });
//   }
// }
// //------------
// async function addUserToGroupChat(userId, courseId) {
//   const chat = await Chat.findOneAndUpdate(
//     { course: courseId, isGroupChat: true },
//     {
//       $addToSet: { participants: { user: userId, isAdmin: false } },
//     },
//     { new: true },
//   );
//   //send notification
//   await Notification.create({
//     user: userId,
//     message: {
//       en: `you has been added to the group ${chat.groupName}`,
//       ar: `تمت اضافتك الى المجموعة ${chat.groupName}`,
//     },
//     chat: chat._id,
//     type: 'chat',
//   });
// }
// async function kickUserFromGroupChat(user, course) {
//   const chat = await Chat.findOneAndUpdate(
//     { course: course._id, isGroupChat: true },
//     { $pull: { participants: { user: user._id } } },
//     { new: true },
//   );
//   //send notification
//   await Notification.create({
//     user: user._id,
//     message: {
//       en: `you has been kicked from the group ${chat.groupName}`,
//       ar: `تمت طردك من المجموعة ${chat.groupName}`,
//     },
//     chat: chat._id,
//     type: 'chat',
//   });
// }
// //------------
// async function subscribeUserToPackage(userId, courseId) {
//   const package = await Package.findOne({ course: courseId });
//   if (package) {
//     const startDate = new Date();
//     const endDate = new Date(startDate);
//     const subscriptionDurationDays = 5 * 30; // 5 months
//     endDate.setDate(startDate.getDate() + subscriptionDurationDays);
//     return await UserSubscription.create({
//       user: userId,
//       package: package._id,
//       startDate,
//       endDate,
//     });
//   }
// }

// // that handles both finding the course and user and processing the course order.
// const createCourseOrderHandler = async (courseId, email, price, method) => {
//   // Step 1: Find course and user
//   const [course, user] = await Promise.all([
//     Course.findById(courseId),
//     User.findOne({ email }),
//   ]);

//   if (!course || !user) {
//     throw new Error('Course or user not found');
//   }

//   // Step 2: Process the course order and related steps
//   await createOrder(user._id, course._id, price, method);
//   await createCourseProgress(user._id, course._id);
//   await addUserToGroupChat(user._id, course._id);
//   await subscribeUserToPackage(user._id, course._id);
//   await availUserToReview(user._id);

//   // Step 3: Calculate profits with optional instructor ID
//   let instructorId = null;
//   if (course.instructorPercentage && course.instructorPercentage > 0) {
//     instructorId = course.instructor;
//   }

//   await calculateProfits({
//     email: user.email,
//     amount: price,
//     item: `Course: ${course.title}`,
//     instructorId: instructorId,
//   });
// };

// // Handler for creating package order
// const createPackageOrderHandler = async (packageId, email, price, method) => {
//   const [package, user] = await Promise.all([
//     Package.findById(packageId),
//     User.findOne({ email }),
//   ]);

//   if (!package || !user) {
//     throw new Error('Package or user not found');
//   }

//   const order = await Order.create({
//     user: user._id,
//     package: package._id,
//     totalOrderPrice: price,
//     isPaid: true,
//     paymentMethodType: method,
//     paidAt: Date.now(),
//   });

//   const startDate = new Date();
//   const endDate = new Date(startDate);
//   endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);

//   const subscription = await UserSubscription.findOne({
//     user: user._id,
//     package: package._id,
//   }).sort({ endDate: -1 });

//   if (subscription) {
//     subscription.endDate = endDate;
//     await subscription.save();
//   } else {
//     await UserSubscription.create({
//       user: user._id,
//       package: package._id,
//       startDate,
//       endDate,
//     });
//   }

//   if (package.type === 'course') {
//     await createCourseProgress(user._id, package.course._id);
//   }

//   await availUserToReview(user._id);

//   await calculateProfits({
//     email: user.email,
//     amount: price,
//     item: `Package: ${package.title}`,
//   });
// };

// // Handler for creating course package order
// const createCoursePackageOrderHandler = async (
//   coursePackageId,
//   email,
//   price,
//   method,
// ) => {
//   const [coursePackage, user] = await Promise.all([
//     CoursePackage.findById(coursePackageId),
//     User.findOne({ email }),
//   ]);

//   if (!coursePackage || !user) {
//     throw new Error('CoursePackage or user not found');
//   }

//   const order = await Order.create({
//     user: user._id,
//     coursePackage: coursePackage._id,
//     totalOrderPrice: price,
//     isPaid: true,
//     paymentMethodType: method,
//     paidAt: Date.now(),
//   });

//   await Promise.all(
//     coursePackage.courses.map(async (courseId) => {
//       const existOrder = await CourseProgress.findOne({
//         user: user._id,
//         course: courseId,
//       });

//       if (!existOrder) {
//         await CourseProgress.create({
//           user: user._id,
//           course: courseId,
//           progress: [],
//         });
//       }

//       const chat = await Chat.findOneAndUpdate(
//         { course: courseId, isGroupChat: true },
//         { $addToSet: { participants: { user: user._id, isAdmin: false } } },
//         { new: true },
//       );

//       if (chat) {
//         await Notification.create({
//           user: user._id,
//           message: `${user.name} has been added to the group ${chat.groupName}`,
//           chat: chat._id,
//           type: 'chat',
//         });
//       }

//       const package = await Package.findOne({ course: courseId });
//       if (package) {
//         const startDate = new Date();
//         const endDate = new Date(startDate);
//         endDate.setDate(startDate.getDate() + 120); // 4 months
//         await UserSubscription.create({
//           user: user._id,
//           package: package._id,
//           startDate,
//           endDate,
//         });
//       }
//     }),
//   );

//   await availUserToReview(user._id);

//   await calculateProfits({
//     email: user.email,
//     amount: price,
//     item: `Course Package: ${coursePackage.title}`,
//   });
// };

// Utility to create order if it doesn’t already exist
async function createOrderIfNotExist(userId, itemId, price, method, itemType) {
  const existingOrder = await Order.findOne({
    user: userId,
    [itemType]: itemId,
    paymentMethodType: method,
  });

  if (!existingOrder) {
    await Order.create({
      user: userId,
      [itemType]: itemId,
      totalOrderPrice: price,
      isPaid: true,
      paymentMethodType: method,
      paidAt: Date.now(),
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
  if (!course || !user) throw new Error("Course or user not found");

  await createOrderIfNotExist(user._id, course._id, price, method, "course");
  await createCourseProgressIfNotExist(user._id, course._id);
  await addUserToGroupChatAndNotify(user._id, course._id);

  if (course.subscriptionPackage) {
    await createOrUpdateSubscription(
      user._id,
      course.subscriptionPackage._id,
      5 * 30
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
  if (!package || !user) throw new Error("Package or user not found");

  await createOrderIfNotExist(user._id, package._id, price, method, "package");
  await createOrUpdateSubscription(
    user._id,
    package._id,
    package.subscriptionDurationDays
  );

  if (package.type === "course" && package.course) {
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
  method
) => {
  const [coursePackage, user] = await Promise.all([
    CoursePackage.findById(coursePackageId),
    User.findOne({ email }),
  ]);
  if (!coursePackage || !user)
    throw new Error("CoursePackage or user not found");

  await createOrderIfNotExist(
    user._id,
    coursePackage._id,
    price,
    method,
    "coursePackage"
  );

  await Promise.all(
    coursePackage.courses.map(async (courseId) => {
      await createCourseProgressIfNotExist(user._id, courseId);
      await addUserToGroupChatAndNotify(user._id, courseId);

      const package = await Package.findOne({ course: courseId });
      if (package) {
        await createOrUpdateSubscription(user._id, package._id, 4 * 30); // 4 months
      }
    })
  );

  await availUserToReview(user._id);
  await calculateProfits({
    email: user.email,
    amount: price,
    item: `Course Package: ${coursePackage.title}`,
  });
};

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
// exports.createCourseOrder = async (req, res, next) => {
//   const { courseId, price, email, method } = req.params;

//   try {
//     // Call the function to handle course order processing
//     await createCourseOrderHandler(courseId, email, price, method);

//     // Redirect user to the specified URL
//     res.redirect(`https://nexgen-academy.com/`);
//   } catch (error) {
//     next(error);
//   }
// };

// // Middleware for creating a package order
// exports.createPackageOrder = async (req, res, next) => {
//   const { packageId, price, email, method } = req.params;

//   try {
//     await createPackageOrderHandler(packageId, email, price, method);
//     res.redirect(`https://nexgen-academy.com/`);
//   } catch (error) {
//     next(error);
//   }
// };

// // Middleware for creating a course package order
// exports.createCoursePackageOrder = async (req, res, next) => {
//   const { coursePackageId, price, email, method } = req.params;

//   try {
//     await createCoursePackageOrderHandler(
//       coursePackageId,
//       email,
//       price,
//       method,
//     );
//     res.redirect(`https://nexgen-academy.com/`);
//   } catch (error) {
//     next(error);
//   }
// };

module.exports = {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
  filterOrders,
  findAllOrders,
  findSpecificOrder,
};
