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
  if (!coupon.isAdminCoupon) {
    const couponMarketerId = coupon.marketer?._id || coupon.marketer;
    const isInstructorCoupon = coupon.marketer?.isInstructor === true;

    if (!isInstructorCoupon && couponMarketerId?.toString() !== marketerId?.toString()) {
      return 'coupon-errors.Un-Authorized';
    }
  }
  return coupon;
};

/**
 * Check if a coupon can be applied to a specific scope and item
 * @param {Object} coupon - The coupon object
 * @param {string} scope - The scope type ('course', 'coursePackage', 'package')
 * @param {string} itemId - The ID of the item to check against
 * @returns {Object} - { canApply: boolean, errorMessage?: string }
 */
exports.canCouponApplyToScope = (coupon, scope, itemId) => {
  switch (scope) {
    case 'course':
      if (coupon.courses && coupon.courses.length > 0) {
        const canApply = coupon.courses.some(
          (courseId) => courseId.toString() === itemId.toString()
        );
        return {
          canApply,
          errorMessage: canApply
            ? null
            : 'This coupon cannot be used for this course',
        };
      }
      break;

    case 'coursePackage':
      if (coupon.coursePackages && coupon.coursePackages.length > 0) {
        const canApply = coupon.coursePackages.some(
          (packageId) => packageId.toString() === itemId.toString()
        );
        return {
          canApply,
          errorMessage: canApply
            ? null
            : 'This coupon cannot be used for this course package',
        };
      }
      break;

    case 'package':
      if (coupon.packages && coupon.packages.length > 0) {
        const canApply = coupon.packages.some(
          (packageId) => packageId.toString() === itemId.toString()
        );
        return {
          canApply,
          errorMessage: canApply
            ? null
            : 'This coupon cannot be used for this package',
        };
      }
      break;

    default:
      return {
        canApply: false,
        errorMessage: 'Invalid scope type',
      };
  }

  // If we reach here, the coupon scope doesn't match the requested scope
  return {
    canApply: false,
    errorMessage: `This coupon cannot be used for ${scope}s`,
  };
};
//----------------------------------------------
exports.filterCoupons = (req, res, next) => {
  if (req.user.role === 'user') {
    req.filterObj = { marketer: req.user.id };
  }
  return next();
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
  if (req.user.role === 'admin') {
    req.body.isAdminCoupon = true;
    req.body.marketer = null;
  } else {
    req.body.isAdminCoupon = false;
    req.body.marketer = req.user.id;
  }

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
    ).populate('courses', 'title').populate('coursePackages', 'title').populate('packages', 'title');
    if (!coupon) {
      return next(new ApiError(res.__('coupon-errors.Not-Found'), 404));
    }
    if (coupon.status !== 'active') {
      return next(new ApiError(res.__('coupon-errors.unActive'), 404));
    }
    if (coupon.maxUsageTimes <= coupon.usedTimes) {
      return next(new ApiError(res.__('coupon-errors.Expired'), 404));
    }

    if (!coupon.isAdminCoupon) {
      const couponMarketerId = coupon.marketer?._id || coupon.marketer;
      const isInstructorCoupon = coupon.marketer?.isInstructor === true;

      if (
        !isInstructorCoupon &&
        couponMarketerId?.toString() !== req.user._id.toString() &&
        couponMarketerId?.toString() !== req.user.invitor?.toString()
      ) {
        return next(new ApiError(res.__('coupon-errors.Un-Authorized'), 404));
      }
    }

    return res.status(200).json({ status: 'success', coupon });
  } catch (error) {
    return res.status(500).json({ status: 'error', error: error.message });
  }
};
