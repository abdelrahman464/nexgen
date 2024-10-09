const { check, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
// exports.getCategoryValidator = [
//   //rules
//   check("id").isMongoId().withMessage("Invalid category id format"),
//   //catch error
//   validatorMiddleware,
// ];

exports.checkAuthority = async (req, res, next) => {
  if (req.user.role !== "admin" && req.user._id.toString() !== req.params.id) {
    return res
      .status(403)
      .json({ message: "You are not allowed to do this action" });
  }
  next();
};

exports.createInvoiceValidator = [
  //rules
  //1
  check("id").isMongoId().withMessage("Invalid marketer id format"),
  //2 validate on query parameter
  query("invoiceType")
    .notEmpty()
    .withMessage("Invoice type is required")
    .isIn(["wallet", "profit", "instructorProfits"])
    .withMessage("unsupported invoice type"),
  //3 conditionally validate on query parameter
  check("reasonToWithdraw")
    .if((value, { req }) => req.query.invoiceType === "wallet")
    .notEmpty()
    .withMessage("Reason to withdraw is required")
    .isString()
    .withMessage("Reason to withdraw must be a string"),
  //3
  check("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isString()
    .withMessage("Payment method must be a string"),
  //4
  check("receiverAcc")
    .notEmpty()
    .withMessage("Receiver account is required")
    .isString()
    .withMessage("Receiver account must be a string"),
  //catch error
  validatorMiddleware,
];
