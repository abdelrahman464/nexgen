const express = require("express");

const userSubscriptionService = require("../services/userSubscriptionService");
const authServices = require("../services/authServices");

const { checkMongoId } = require("../utils/public/publicValidator");

const router = express.Router();

router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    userSubscriptionService.createFilterObj,
    userSubscriptionService.getMySubscriptions
  );
router
  .route("/:id") //pcakege id
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    checkMongoId("id"),
    userSubscriptionService.AddsubscriberToCollection
  );

module.exports = router;
