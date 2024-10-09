const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const SystemReview = require("../../models/systemReviewModel");
const ApiError = require("../apiError");
const CourseProgress = require("../../models/courseProgressModel");

exports.createValidator = [
  check("title").optional(),
  check("ratings")
    .notEmpty()
    .withMessage("ratings required")
    .isFloat({ min: 1, max: 5 })
    .withMessage("ratings must be between 1 and 5"),
  check("user")
    .isMongoId()
    .withMessage("Invalid user id format")
    .custom(async (val, { req }) => {
      // Check if the user bought any course before
      const userprogress = await CourseProgress.findOne({
        user: req.user._id,
      });
      if (!userprogress) {
        throw new ApiError(403, "You are not allowed to review");
      }

      //check if user create a review before
      const review = await SystemReview.findOne({
        user: req.user._id,
      });
      if (review) {
        return Promise.reject(new Error("you already have a review"));
      }
    }),
  validatorMiddleware,
];
exports.getValidator = [
  //rules
  check("id").isMongoId().withMessage("Invalid Review id format"),
  //catch error
  validatorMiddleware,
];
exports.updateValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom((val, { req }) =>
      // Check review ownership before update
      SystemReview.findById(val).then((review) => {
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
exports.deleteValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom((val, { req }) =>
      // Check review ownership before update
      SystemReview.findById(val).then((review) => {
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
