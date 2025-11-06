const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const {
  checkUserSubscription,
} = require("../../services/userSubscriptionService");
const Course = require("../../models/courseModel");
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
    if (!req.body.course || req.user.admin || req.user.role === "moderator") {
      return next();
    }
    if (!req.user.isInstructor && req.body.sharedTo !== "profile") {
      const { course } = req.body;
      await checkUserSubscription(req.user._id, course);
    } else if (req.user.isInstructor) {
      const { course } = req.body;
      const isCourseOwnedByInstructor = await Course.findOne({
        _id: course,
        instructor: req.user._id,
      });
      if (!isCourseOwnedByInstructor) {
        return next(
          new ApiError(
            "You are not the instructor of this course to post on its feed",
            403
          )
        );
      }
    }
    return next();
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
