const { check, body } = require("express-validator");
const mongoose = require("mongoose");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const MarketLog = require("../../models/MarketingModel");

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
    .withMessage("amount must be a number"),

  //catch error
  validatorMiddleware,
];

//------------------------------------
exports.modifyInvitationKeysValidator = [
  //rules
  check("option")
    .notEmpty()
    .withMessage("option is required")
    .isIn(["add", "remove"])
    .withMessage("option must be add or remove"),
  check("id").isMongoId().withMessage("Invalid marketer id format"),
  check("invitationKey")
    .notEmpty()
    .withMessage("invitationKey are required")
    .isString()
    .withMessage("invitationKeys must be String")
    .custom(async (value, { req }) => {
      if (req.body.option === "add") {
        const isExist = await MarketLog.findOne({ invitationKeys: value });
        if (isExist) throw new Error("invitationKey already exist");
      }
    }),
  //catch error
  validatorMiddleware,
];

exports.validateProfitCalculation = [
  check("profitsCalculationMethod")
    .optional()
    .isIn(["manual", "auto"]) // Allowed values
    .withMessage('Calculation method must be either "manual" or "auto"'),

  check("profitPercentage")
    .if(body("profitsCalculationMethod").equals("manual"))
    .notEmpty()
    .withMessage("Profit percentage is required for manual calculation")
    .isFloat({ gt: 0 })
    .withMessage("Profit percentage must be greater than 0"),

  check("commissionsProfitsCalculationMethod")
    .optional()
    .isIn(["manual", "auto"]) // Allowed values
    .withMessage(
      'commissionsProfitsCalculationMethod must be either "manual" or "auto"'
    ),

  check("commissionsProfitsPercentage")
    .if(body("commissionsProfitsCalculationMethod").equals("manual"))
    .notEmpty()
    .withMessage(
      "commissionsProfitsPercentage is required for manual calculation"
    )
    .isFloat({ gt: 0 })
    .withMessage("commissionsProfitsPercentage must be greater than 0"),
  validatorMiddleware,
];

exports.checkTypeQueryParam = [
  check("type")
    .notEmpty()
    .withMessage("type is required")
    .isIn(["instructor", "marketer", "affiliate"])
    .withMessage(
      'type must be either "instructor", "marketer", or "affiliate"'
    ),

  // Custom validator for fallBackCoach
  check("fallBackCoach").custom((value, { req }) => {
    if (req.query.type === "affiliate") {
      if (!value) {
        throw new Error("fallBackCoach is required for affiliate type");
      }
      // Optionally validate it’s a MongoId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid fallBackCoach id format");
      }
    }
    return true;
  }),

  validatorMiddleware,
];

exports.checkTypeQueryParam2 = [
  check("role")
    .notEmpty()
    .withMessage("role is required")
    .isIn(["instructor", "marketer", "affiliate"])
    .withMessage(
      'role must be either "instructor", "marketer", or "affiliate"'
    ),

  // Custom validator for fallBackCoach
  check("fallBackCoach").custom((value, { req }) => {
    if (req.query.type === "affiliate") {
      if (!value) {
        throw new Error("fallBackCoach is required for affiliate type");
      }
      // Optionally validate it’s a MongoId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid fallBackCoach id format");
      }
    }
    return true;
  }),

  validatorMiddleware,
];