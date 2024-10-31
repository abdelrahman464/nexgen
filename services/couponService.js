const Coupon = require("../models/couponModel");
const factory = require("./handllerFactory");
const ApiError = require("../utils/apiError");

exports.validateCoupon = async (couponName, marketerId) => {
  const coupon = await Coupon.findOne({ couponName });
  if (!coupon) {
    throw new Error(`This coupon doesn't exist`);
  }
  if (coupon.status === "rejected") {
    throw new Error(`This coupon is not valid`);
  }
  if (coupon.maxUsageTimes <= coupon.usedTimes) {
    throw new Error(`This coupon is expired`);
  }
  if (coupon.marketer === marketerId)
    throw new Error(`this coupon not belong to your marketer`);
  return true;
};

//@desc get list of coupons
//@route GET /api/v1/coupons
//@access public
exports.getAll = factory.getALl(Coupon);

//@desc get specific Coupon by id
//@route GET /api/v1/coupons/:id
//@access public
exports.getOne = factory.getOne(Coupon);

//@desc create coupon
//@route POST /api/v1/coupons
//@access private/protect/user  => role: marketer
exports.createOne = (req, res, next) => {
  req.body.marketer = req.user.id;
  return factory.createOne(Coupon)(req, res, next);
};

//@desc update specific Coupon
//@route PUT /api/v1/coupons/:id
//@access private/protect/user   => role: admin
exports.updateOne = factory.updateOne(Coupon);

//@desc delete coupon
//@route DELETE /api/v1/coupons/:id
//@access private/protect/user-admin
exports.deleteOne = factory.deleteOne(Coupon);

// //@desc increment usedTimes of coupon after successful payment
exports.incrementCouponUsedTimes = async (couponName) => {
  await Coupon.findOneAndUpdate(
    { couponName },
    { $inc: { usedTimes: 1 } },
    { new: true }
  );
  return true;
};
// //@desc reply to Review
