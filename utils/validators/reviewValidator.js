const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Review = require("../../models/reviewModel");
const Course = require("../../models/courseModel");
const ApiError = require("../apiError");
const CourseProgress = require("../../models/courseProgressModel");

exports.createReviewValidator = [
  check("title").optional(),
  check("ratings")
    .notEmpty()
    .withMessage("ratings required")
    .isFloat({ min: 1, max: 5 })
    .withMessage("ratings must be between 1 and 5"),
  check("user").isMongoId().withMessage("Invalid user id format"),
  check("course")
    .isMongoId()
    .withMessage("Invalid course id format")
    .custom(async (val, { req }) => {
      const course = await Course.findById(val);
      if (!course) {
        throw new Error(`There are no course for this id ${val}`);
      }
      if (req.user.role === "admin") {
        return Promise.resolve();
      }
      // Check if the user is already in the course
      const userprogress = await CourseProgress.findOne({
        user: req.user._id,
        course: val,
      });
      if (!userprogress) {
        throw new ApiError(403, "You are not allowed to review this course");
      }

      //check if logged user create review before
      const review = await Review.findOne({
        user: req.user._id,
        course: req.body.course,
      });
      if (review) {
        return Promise.reject(new Error("you already have a review"));
      }
    }),
  validatorMiddleware,
];
//------------------------------------------------------------//
exports.getReviewValidator = [
  //rules
  check("id").isMongoId().withMessage("Invalid Review id format"),
  //catch error
  validatorMiddleware,
];
exports.updateReviewValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom((val, { req }) =>
      // Check review ownership before update
      Review.findById(val).then((review) => {
        if (!review) {
          return Promise.reject(new Error(`There is no review with id ${val}`));
        }

        if (review.user._id.toString() !== req.user._id.toString()) {
          return Promise.reject(
            new Error(`Your are not allowed to perform this action`)
          );
        }
      })
    ),

  validatorMiddleware,
];
exports.deleteReviewValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom((val, { req }) =>
      // Check review ownership before update
      Review.findById(val).then((review) => {
        if (!review) {
          return Promise.reject(new Error(`There is no review with id ${val}`));
        }
        if (req.user.role !== "admin") {
          if (review.user._id.toString() !== req.user._id.toString()) {
            return Promise.reject(
              new Error(`Your are not allowed to perform this action`)
            );
          }
        }
      })
    ),
  validatorMiddleware,
];
