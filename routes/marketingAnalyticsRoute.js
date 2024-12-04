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

module.exports = router;
