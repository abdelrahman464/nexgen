const { body, check } = require("express-validator");
const Course = require("../../models/courseModel");
const ApiError = require("../apiError");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.addCourseToWishlistValidator = [
  body("courseId")
    .notEmpty()
    .withMessage("course required")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(
            new ApiError(`No course for this id : ${courseId}`, 404)
          );
        }
      })
    ),
  validatorMiddleware,
];

exports.removeCourseFromWishlistValidator = [
  check("courseId")
    .notEmpty()
    .withMessage("course required")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(
            new ApiError(`No course for this id : ${courseId}`, 404)
          );
        }
      })
    ),
  validatorMiddleware,
];
