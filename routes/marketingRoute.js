const express = require("express");
const authServices = require("../services/authServices");
const {
  calculateProfitsManual,
  startMarketing,
  getMarketLog,
  getMarketerChildren,
  createInvoice,
  setPaymentDetails,
  modifyInvitationKeys,
  updateMarketLogProfitsCalculationMethod,
  modifyProfitableItems,
  getProfitableItemsByType,
} = require("../services/marketing/marketingService");
const {
  getInstructorAnalytics,
} = require("../services/marketing/instructorProfitsService");

const {
  checkAuthority,
  createInvoiceValidator,
  modifyInvitationKeysValidator,
  validateProfitCalculation,
  checkTypeQueryParam,
} = require("../utils/validators/marketingValidator");

const router = express.Router();

router.use(authServices.protect);

router.get(
  "/getInstructorAnalytics/:id?",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  getInstructorAnalytics
);
router.get(
  "/getMarketLog/:id",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkAuthority,
  getMarketLog
);
router.get(
  "/getMyMarketLog",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  getMarketLog
);
//check if req is the owner or admin
router.get(
  "/getMarketerChildren/:id", //id is the marketer id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  getMarketerChildren
);

router.patch(
  "/updateMarketLogProfitsCalculationMethod/:id", //id is the marketer id
  authServices.protect,
  authServices.allowedTo("admin"),
  validateProfitCalculation,
  updateMarketLogProfitsCalculationMethod
);

router.put(
  "/modifyInvitationKeys/:id", //id is the marketer id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  modifyInvitationKeysValidator,
  modifyInvitationKeys
);
router.put(
  "/setPaymentDetails/:id", //id is the marketer id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkTypeQueryParam,
  setPaymentDetails
);
//for testing purposes not for production
router.put(
  "/calculateProfitsManual",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  calculateProfitsManual
);
router.put(
  "/withdrawMoney/:id", //marketer id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkAuthority,
  createInvoiceValidator,
  checkTypeQueryParam,
  createInvoice
);
router.put(
  "/modifyProfitableItems/:id", //marketer id
  authServices.allowedTo("user", "admin"),
  checkAuthority,
  modifyProfitableItems
);

router.put(
  "/startMarketing/:userId",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkTypeQueryParam,
  startMarketing
);

router.get(
  "/getProfitableItemsByType",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  getProfitableItemsByType
);

module.exports = router;
