const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.checkMongoId = [
  check("id").isMongoId().withMessage("Invalid ID format"),
  validatorMiddleware,
];
exports.isUserSubscribed = async (req, res, next) => {
  console.log(req.user.role, req.user.authToReview);
  if (req.user.role === "admin" || req.user.authToReview) {
    return next();
  }
  return res.status(401).json({
    status: "faild",
    message: "Unauthorized action , You are not subscribed to any package",
  });
};
exports.isIdParamForSender = async (req, res, next) => {
  if (req.user.role === "admin" || req.user._id.toString() === req.params.id) {
    return next();
  }
  return res.status(401).json({
    status: "failed",
    message: "Unauthorized action",
  });
};
