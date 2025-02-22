const { check, query } = require("express-validator");
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
