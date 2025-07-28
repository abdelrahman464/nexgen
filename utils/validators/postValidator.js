const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const {
  checkUserSubscription,
} = require("../../services/userSubscriptionService");

exports.processPostValidator = [
  check("id").isMongoId().withMessage("Invalid Requst id format"),
  validatorMiddleware,
];

exports.createPostValidator = [
  check("content").notEmpty().withMessage("content is required"),
  check("sharedTo")
    .notEmpty()
    .withMessage("sharedTo is required")
    .isIn(["package", "course", "home", "profile"])
    .withMessage("invalid value"),
  check("images")
    .optional()
    .isArray()
    .withMessage("images should be array of string"),
  check("course")
    .optional()
    .isMongoId()
    .withMessage("Invalid Requst id format"),
  validatorMiddleware,
];

exports.getPostValidator = [
  check("id").isMongoId().withMessage("Invalid Requst id format"),
  validatorMiddleware,
];

exports.checkCourseAuthority = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.body.sharedTo !== "profile") {
      const { course } = req.body;
      await checkUserSubscription(req.user._id, course);
    }
    return next();
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
