const express = require("express");

const systemReviewServices = require("../services/systemReviewServices");
const validator = require("../utils/validators/systemReviewValidator");
const authServices = require("../services/authServices");

// const { isUserSubscribed } = require("../utils/public/publicValidator");

const router = express.Router();

router
  .route("/myReviews")
  .get(
    authServices.protect,
    systemReviewServices.filterToGetMyReviews,
    systemReviewServices.getAll
  );
router.route("/").get(systemReviewServices.getAll).post(
  authServices.protect,
  // isUserSubscribed,
  systemReviewServices.setUserIdToBody,
  validator.createValidator,
  systemReviewServices.create
);
router
  .route("/:id")
  .get(validator.getValidator, systemReviewServices.getOne)
  .put(
    authServices.protect,
    validator.updateValidator,
    systemReviewServices.update
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    validator.deleteValidator,
    systemReviewServices.delete
  );
router
  .route("/:id/replay")
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    systemReviewServices.replay
  );
module.exports = router;
