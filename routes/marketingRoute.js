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
} = require("../services/marketing/marketingService");

const {
  checkAuthority,
  createInvoiceValidator,
  modifyInvitationKeysValidator,
  validateProfitCalculation,
} = require("../utils/validators/marketingValidator");

const router = express.Router();

router.use(authServices.protect);

router.get(
  "/getMarketLog/:id",
  // authServices.protect,
  // authServices.allowedTo("user", "admin"),
  // checkAuthority,
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
  createInvoice
);

router.put(
  "/startMarketing/:userId",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  startMarketing
);

module.exports = router;
