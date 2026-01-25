const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Coupon = require("../../models/couponModel");
const ApiError = require("../apiError");

exports.createCouponValidator = [
  check("couponName")
    .notEmpty()
    .withMessage("couponName is required")
    .isString()
    .withMessage(`couponName must be a string.`)
    .custom(async (couponName) => {
      const coupon = await Coupon.findOne({ couponName });
      if (coupon && coupon.status !== "active") {
        return Promise.reject(
          new ApiError(
            `This coupon already exist with ${coupon.status} status`,
            400
          )
        );
      }
    }),

  check("reason")
    .notEmpty()
    .withMessage("reason is required")
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  check("discount")
    .notEmpty()
    .withMessage("discount is required")
    .isNumeric()
    .withMessage("discount must be a number")
    .isLength({ max: 100 })
    .withMessage("invalid discount value"),
  check("maxUsageTimes")
    .notEmpty()
    .withMessage("maxUsageTimes is required")
    .isNumeric()
    .withMessage("maxUsageTimes must be a number"),

  //catch error and return it as a response
  validatorMiddleware,
];
exports.updateCouponValidator = [
  check("couponName")
    .optional()
    .isString()
    .withMessage(`couponName must be a string.`)
    .custom(async (couponName) => {
      const coupon = await Coupon.findOne({ couponName });
      if (coupon && coupon.status !== "active") {
        return Promise.reject(
          new ApiError(
            `This coupon already exist with ${coupon.status} status`,
            400
          )
        );
      }
    }),

  check("reason")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  check("discount")
    .optional()
    .isNumeric()
    .withMessage("discount must be a number")
    .isLength({ max: 100 })
    .withMessage("invalid discount value"),
  check("maxUsageTimes")
    .optional()
    .isNumeric()
    .withMessage("maxUsageTimes must be a number"),
  check("status")
    .optional()
    .isString()
    .withMessage(`status must be a string.`)
    .isIn(["pending", "active", "rejected"])
    .withMessage("invalid status value"),

  //catch error and return it as a response
  validatorMiddleware,
];

exports.canPerformCouponAction = async (req, res, next) => {
  if (req.user.role !== "admin" && !req.user.isMarketer && !req.user.isInstructor) {
    return next(
      new ApiError("You are not allowed to perform this action", 403)
    );
  }
  return next();
};
