const Coupon = require('../models/couponModel');
const factory = require('./handllerFactory');
const ApiError = require('../utils/apiError');

exports.validateCoupon = async (couponName, marketerId) => {
  const coupon = await Coupon.findOne({ couponName });
  if (!coupon) {
    return 'coupon-errors.Not-Found';
  }
  if (coupon.status === 'rejected') {
    return 'coupon-errors.unActive';
  }
  if (coupon.maxUsageTimes <= coupon.usedTimes) {
    return 'coupon-errors.Expired';
  }
  if (coupon.marketer._id !== marketerId) return 'coupon-errors.Un-Authorized';
  return coupon;
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
    { new: true },
  );
  return true;
};

exports.getCouponDetails = async (req, res, next) => {
  try {
    const { couponName } = req.params;
    const coupon = await Coupon.findOne({ couponName }).select(
      '-__v -updatedAt',
    );
    if (!coupon) {
      return next(new ApiError(res.__('coupon-errors.Not-Found'), 404));
    }
    if (coupon.status !== 'active') {
      return next(new ApiError(res.__('coupon-errors.unActive'), 404));
    }
    if (coupon.maxUsageTimes <= coupon.usedTimes) {
      return next(new ApiError(res.__('coupon-errors.Expired'), 404));
    }

    if (
      coupon.marketer._id.toString() !== req.user._id.toString() &&
      coupon.marketer._id.toString() !== req.user.invitor?.toString()
    )
      return next(new ApiError(res.__('coupon-errors.Un-Authorized'), 404));

    return res.status(200).json({ status: 'success', coupon });
  } catch (error) {
    return res.status(500).json({ status: 'error', error: error.message });
  }
};
