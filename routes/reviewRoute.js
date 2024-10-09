const express = require("express");
const {
  getReviewValidator,
  createReviewValidator,
  updateReviewValidator,
  deleteReviewValidator,
} = require("../utils/validators/reviewValidator");

const {
  createUserFilterObj,
  createFilterObj,
  setCourseIdAndUserIdToBody,
  getReviews,
  createReview,
  getReview,
  updateReview,
  deleteReview,
  replyToReview,
} = require("../services/reviewService");

const authServices = require("../services/authServices");

const router = express.Router();
router.put(
  "/:id/reply",
  authServices.protect,
  authServices.allowedTo("admin"),
  replyToReview
);
router.get(
  "/myReview",
  authServices.protect,
  authServices.allowedTo("user"),
  createUserFilterObj,
  getReviews
);
router
  .route("/")
  .get(createFilterObj, getReviews)
  .post(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    setCourseIdAndUserIdToBody,
    createReviewValidator,
    createReview
  );
router
  .route("/:id")
  .get(getReviewValidator, getReview)
  .put(
    authServices.protect,
    authServices.allowedTo("user"),
    updateReviewValidator,
    updateReview
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    deleteReviewValidator,
    deleteReview
  );

module.exports = router;
