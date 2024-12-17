const express = require("express");
const authServices = require("../services/authServices");
const marketingAnalyticsService = require("../services/marketing/marketingAnalyticsService");

const router = express.Router();

router.get(
  "/total/:id?", //marketing id
  authServices.protect,
  authServices.allowedTo("admin"),
  marketingAnalyticsService.getTotalSalesAnalytics
);
router.get(
  "/item/:id?", //item id
  authServices.protect,
  authServices.allowedTo("admin"),
  marketingAnalyticsService.getItemAnalytics
);
router.get(
  "/getInvitationsAnalytics/:marketerId", //marketer id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  //validation layer on [marketerId , month ,year ,invitationKey]
  marketingAnalyticsService.getInvitationsAnalytics
);
router.put(
  "/incrementSignUpClicks/:marketerId", //marketing id
  marketingAnalyticsService.incrementSignUpClicks
);

module.exports = router;
