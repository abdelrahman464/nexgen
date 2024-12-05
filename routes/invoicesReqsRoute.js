const express = require("express");
const authServices = require("../services/authServices");
const {
  getAllRequestedInvoices,
  getRequestedInvoice,
  updateInvoiceStatus,
} = require("../services/marketing/marketingInvoicesService");
const {
  checkStatusValidator,
  updateInvoiceStatusValidator,
} = require("../utils/validators/invoicesReqsValidator");
const { checkMongoId } = require("../utils/public/publicValidator");

const router = express.Router();

router
  .route("/:status?")
  .get(authServices.protect, checkStatusValidator, getAllRequestedInvoices);

router
  .route("/one/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    checkMongoId,
    getRequestedInvoice
  );
router
  .route("/updateInvoiceStatus/:id")
  .put(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    updateInvoiceStatusValidator,
    updateInvoiceStatus
  );

module.exports = router;
