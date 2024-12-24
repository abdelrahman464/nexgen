const { check, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
// exports.getCategoryValidator = [
//   //rules
//   check("id").isMongoId().withMessage("Invalid category id format"),
//   //catch error
//   validatorMiddleware,
// ];

exports.checkAuthority = async (req, res, next) => {
  if (req.user.role !== "admin" && req.user._id.toString() !== req.params.id) {
    next(new ApiError(res.__("errors.Not-Authorized"), 403));
  }
  next();
};

exports.createInvoiceValidator = [
  //rules
  //1
  check("id").isMongoId().withMessage("Invalid marketer id format"),

  //3 conditionally validate on query parameter
  check("amount")
    .notEmpty()
    .withMessage("amount is required")
    .isNumeric()
    .withMessage("amount must be a number")
    ,

  //catch error
  validatorMiddleware,
];

//------------------------------------
exports.modifyInvitationKeysValidator = [
  //rules
  query("option")
    .optional()
    .isIn(["add", "remove"])
    .withMessage("option must be add or remove"),
  check("id").isMongoId().withMessage("Invalid marketer id format"),
  check("keys")
    .notEmpty()
    .withMessage("Keys are required")
    .isArray()
    .withMessage("Keys must be an array"),
  //catch error
  validatorMiddleware,
];
