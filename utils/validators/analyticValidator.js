const { check, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const User = require("../../models/userModel");
const Analytic = require("../../models/analyticsModel");
const { getUserAsDoc } = require("../../services/userService");

//------------------------------------------------
/**
 *@isTranslated => ture
 *   */
exports.hasInvitor = async (req, res, next) => {
  if (!req.user.invitor) {
    return next(new ApiError(res.__("analytics-errors.hasNoInvitor"), 400));
  }
  //check if the invitor is a valid user
  const invitor = await User.findById(req.user.invitor);
  if (!invitor) {
    return next(new ApiError(res.__("analytics-errors.hasNoInvitor"), 400));
  }
  return next();
};
//------------------------------------------------
/**
 *@isTranslated => ture
 *   */
exports.isAuthorized = async (req, res, next) => {
  const { id } = req.params;
  if (req.user.role === "admin") {
    return next();
  }
  const analytic = await Analytic.findById(id);
  if (!analytic) {
    return next(new ApiError(res.__("analytics-errors.One-Not-Found"), 404));
  }
  if (
    analytic.user.toString() !== req.user._id.toString() && //not owner
    analytic.marketer &&
    analytic.marketer.toString() !== req.user._id.toString() //not marketer
  ) {
    return next(new ApiError(res.__("errors.Not-Authorized"), 401));
  }

  return next();
};
//------------------------------------------------
exports.analyticPerformanceValidator = [
  check("id").isMongoId().withMessage("Invalid user id format"),
  query("startDate")
    .notEmpty()
    .withMessage("startDate is required")
    .custom((value) => {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(value)) {
        throw new Error("Invalid date format");
      }
      return true;
    }),
  query("endDate")
    .notEmpty()
    .withMessage("endDate is required")
    .custom((value) => {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(value)) {
        throw new Error("Invalid date format it should be yyyy-mm-dd");
      }
      return true;
    }),
  validatorMiddleware,
];
//------------------------------------------------
exports.isRequestFromHisTrainer = async (req, res, next) => {
  const userId = req.params.id;
  if (
    req.user.role === "admin" ||
    req.user._id.toString() === userId.toString()
  )
    return next();

  const user = await getUserAsDoc(
    {
      _id: req.params.id,
    },
    "_id invitor"
  );
  if (!user) {
    const doc = "user";
    return next(new ApiError(res.__("errors.Not-Found", { doc }), 401));
  }
  if (!user.invitor)
    return next(new ApiError(res.__("analytics-errors.hasNoInvitor"), 401));

  if (user.invitor.toString() !== req.user._id.toString())
    return next(
      new ApiError(res.__("analytics-errors.Un-Authorized-Invitor"), 401)
    );

  return next();
};
