const express = require("express");
const authServices = require("../services/authServices");
const marketerRatingService = require("../services/marketerRatingService");

const router = express.Router();

router
  .route("/")
  .get(
    marketerRatingService.filterMarketerObjects,
    marketerRatingService.getAll
  )
  .post(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    marketerRatingService.createOne
  );
router
  .route("/:id")
  .get(marketerRatingService.getOne)
  .delete(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    marketerRatingService.deleteOne
  );

module.exports = router;
