const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");

// exports.checkMongoId = [
//   check("id").isMongoId().withMessage("Invalid ID format"),
//   validatorMiddleware,
// ];
exports.checkMongoId = (variableName) => [
  check(variableName).isMongoId().withMessage(`Invalid ${variableName} format`),
  validatorMiddleware,
];
//------------------------------------------------
exports.isUserSubscribed = async (req, res, next) => {
  if (req.user.role === "admin" || req.user.isInstructor ||req.user.authToReview) {
    return next();
  }
  return next(new ApiError(res.__("user-errors.unSubscribe"), 401));
};
//------------------------------------------------
exports.isIdParamForSender = async (req, res, next) => {
  if (req.user.role === "admin" || req.user.isMarketer || req.user._id.toString() === req.params.id) {
    return next();
  }
  return next(new ApiError(res.__("errors.Not-Authorized"), 401));
};
