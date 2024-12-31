const { check, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

//1
exports.updateInvoiceStatusValidator = [
  query("invoiceType")
    .notEmpty()
    .withMessage("Invoice type is required")
    .isIn(["wallet", "profit", "instructorProfits"])
    .withMessage(
      "unsupported invoice type , only wallet, profit or instructorProfits allowed"
    ),
  check("id")
    .notEmpty()
    .withMessage("Invoice ID required")
    .isMongoId()
    .withMessage("Invalid Invoice ID format"),
  check("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(["pending", "paid", "rejected"])
    .withMessage("Invalid Status : only pending, paid or rejected allowed"),
  validatorMiddleware,
];
//2
exports.checkStatusValidator = [
  query("invoiceType")
    .notEmpty()
    .withMessage("Invoice type is required")
    .isIn(["wallet", "profit", "instructorProfits"])
    .withMessage(
      "unsupported invoice type , only wallet, profit or instructorProfits allowed"
    ),
  check("status")
    .optional()
    .isIn(["pending", "paid", "rejected"])
    .withMessage("Invalid Status : only pending, paid or rejected allowed"),
  validatorMiddleware,
];
