const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Order = require("../../models/orderModel");
const ApiError = require("../apiError");

exports.processPostValidator = [
  check("id").isMongoId().withMessage("Invalid Requst id format"),
  validatorMiddleware,
];

exports.createPostValidator = [
  check("content").notEmpty().withMessage("content is required"),
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
  if (req.user.role !== "admin") {
    const order = await Order.find({
      user: req.user._id,
      course: { $in: req.body.course },
    });
  
    if (order.length !== req.body.course.length) {
      return next(
        new ApiError("you are not member of all of these courses", 403)
      );
    }
  }
  return next();
};
