const express = require("express");

const {
  addCourseToWishlistValidator,
  removeCourseFromWishlistValidator,
} = require("../utils/validators/wishlistValidator");
const {
  getLoggedUserWishlist,
  addCourseToWishlist,
  removeCourseFromWishlist,
} = require("../services/wishlistService");
const authServices = require("../services/authServices");

const router = express.Router();

router.use(authServices.protect, authServices.allowedTo("admin", "user"));

router
  .route("/")
  .get(getLoggedUserWishlist)
  .post(addCourseToWishlistValidator, addCourseToWishlist);
router.delete(
  "/:courseId",
  removeCourseFromWishlistValidator,
  removeCourseFromWishlist
);

module.exports = router;
