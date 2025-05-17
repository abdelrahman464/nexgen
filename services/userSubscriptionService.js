const asyncHandler = require('express-async-handler');
const Package = require('../models/packageModel');
const UserSubscription = require('../models/userSubscriptionModel');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const OrderService = require('./orders/OrderService');

//@desc : add subscriber to collection manually
exports.AddsubscriberToCollection = asyncHandler(async (req, res, next) => {
  const { user } = req.body;
  const packageId = req.params.id;

  const package = await Package.findById(packageId);
  if (!package) {
    return next(new ApiError('Collection Not Found', 404));
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);

  const subscription = await UserSubscription.create({
    user,
    package: packageId,
    startDate,
    endDate,
  });
  return res.status(201).json({ subscription });
});

exports.createFilterObj = (req, res, next) => {
  let filterObject = {};
  filterObject = { user: req.user._id };
  req.filterObj = filterObject;
  next();
};
exports.getMySubscriptions = factory.getALl(UserSubscription);

// exports.checkUserSubscription = asyncHandler(async (req, res, next) => {
//   const { userId } = req.user._id;
//   const { collectionId } = req.params;
//   const subscription = await UserSubscription.findOne({
//     user,
//     collectionId,
//   }).sort({ endDate: -1 });

//   if (!subscription) {
//     return next(new ApiError("Subscription Not Found", 404));
//   }

//   const now = new Date();
//   if (!subscription.endDate.getTime() > now) {
//     return next(new ApiError("Subscription has expired. Please renew.", 403));
//   }
//   next();
// });
//-----------------------
exports.checkUserSubscription = async (user, course = null) => {
  const filter = {
    user: user._id,
  };
  let courseTitle;

  if (course) {
    const package = await Package.findOne({ course: course }).select(
      '_id course',
    );
    if (!package) {
      throw new Error(`no package exists for courseId: ${course}`);
    }
    filter.package = package._id;
    courseTitle = package.course.title.en;

    const packageSubscription = await UserSubscription.findOne(filter);
    if (!packageSubscription) {
      throw new Error(
        `you are not subscribed to package for course ${courseTitle}`,
      );
    }
    const now = new Date();
    if (packageSubscription.endDate.getTime() < now) {
      const errMessage = `your subscribtion to package for course ${courseTitle} has expired`;
      throw new Error(errMessage);
    }
  } else {
    const allUserSubscribtions = await UserSubscription.find({
      user: user._id,
    }).sort({
      endDate: -1,
    });

    if (allUserSubscribtions.length === 0) {
      throw new Error(`you are not subscribed to any package`);
    }
    const lastSubscription = allUserSubscribtions[0];
    const now = new Date();
    if (lastSubscription.endDate.getTime() < now) {
      const errMessage = `your lastSubscription has been expired`;
      throw new Error(errMessage);
    }
  }
  return true; // Valid subscription found
};
//--------------------------------
exports.subscribeToFreePackage = async (courseId, userId) => {
  try {
    const package = await Package.findOne({ course: courseId }).select(
      '_id price subscriptionDurationDays',
    );
    if (!package) {
      return;
    }
    if (package.price && package.price > 0) {
      return;
    }
    // const isUserSubscribed = await UserSubscription.findOne({
    //   user: userId,
    //   package: package._id,
    // });
    // if (isUserSubscribed) {
    //   return;
    // }
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);

    await UserSubscription.create({
      user: userId,
      package: package._id,
      startDate,
      endDate,
    });
    await OrderService.makeSureUserInChat(package._id, userId);
  } catch (error) {
    console.log(`subscribeToFreePackage \nerror: ${error.message}`);
  }
};
//680d051cf1cfb2c30b2b1497  delete all chats related to this package
// you can not do this , because chat related with course Not package
