const asyncHandler = require("express-async-handler");
const Package = require("../models/packageModel");
const UserSubscription = require("../models/userSubscriptionModel");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");

//@desc : add subscriber to collection manually
exports.AddsubscriberToCollection = asyncHandler(async (req, res, next) => {
  const { user } = req.body;
  const packageId = req.params.id;

  const package = await Package.findById(packageId);
  if (!package) {
    return next(new ApiError("Collection Not Found", 404));
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
      "_id course"
    );
    if (!package) {
      throw new Error(`Package not found for course ${course}`);
    }
    filter.package = package._id;

    courseTitle = package.course.title.en;
  }
  const subscription = await UserSubscription.findOne({
    filter,
  });

  if (!subscription) {
    const errMessage = course
      ? `you are not subscribed to package for course ${courseTitle}`
      : `you are not subscribed to any package`;
    throw new Error(errMessage);
  }

  const now = new Date();
  if (subscription.endDate.getTime() < now) {
    const errMessage = `your subscribtion to package for course ${courseTitle} has expired`;

    throw new Error(errMessage);
  }

  return true; // Valid subscription found
};
