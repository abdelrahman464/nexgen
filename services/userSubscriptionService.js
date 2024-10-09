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
