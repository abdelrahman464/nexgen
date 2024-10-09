const { check, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const User = require("../../models/userModel");

exports.purchaseForUserValidator = [
  check("id")
    .notEmpty()
    .withMessage("item id is required")
    .isMongoId()
    .withMessage("invalid item id "),
  check("type")
    .notEmpty()
    .withMessage("type is required")
    .isIn(["course", "package", "coursePackage"])
    .withMessage(
      "invalid type , type should be course or package or coursePackage"
    ),
  check("userId")
    .notEmpty()
    .withMessage("userId is required")
    .isMongoId()
    .withMessage("invalid userId "),
  check("isPaid")
    .notEmpty()
    .withMessage("isPaid key is required ")
    .isIn([true, false])
    .withMessage("isPaid key should be either true or false"),

  validatorMiddleware,
];

exports.queryParamsValidator = [
  query("userId").optional().isMongoId().withMessage("invalid userId "),
  query("startDate").optional(),
  query("endDate").optional(),
  validatorMiddleware,
];
/*desc: check if the sender of request is authorized to view the orders of specific user
------- this middleware is used in only when sender is trying to view the orders of specific user
    logic:
        if sender is admin ? pass him 
        else ? check if the sender is the invitor of the user ? pass him
        else ? throw error

*/

exports.isAuthToView = async (req, res, next) => {
  try {
    if (req.query.userId) {
      if (req.user.role !== "admin") {
        const isUserExist = await User.exists({
          _id: req.query.userId,
          invitor: req.user._id,
        });
        //check if the sender of request is the invitor of the user
        if (isUserExist) {
          return next();
        }
        throw new Error("You are not authorized to view this user's orders");
      }
    }
    //if sender of request is admin
    return next();
  } catch (err) {
    return res.status(403).json({ status: `failed`, error: err.message });
  }
};
