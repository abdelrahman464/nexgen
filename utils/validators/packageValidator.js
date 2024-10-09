const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const apiError = require("../apiError");
const Subscription = require("../../models/userSubscriptionModel");

// exports.createArticalValidator = [
//   check("title")
//     .notEmpty()
//     .withMessage("Artical title required")
//     .isLength({ min: 2 })
//     .withMessage("Artical title too short")
//     .isLength({ max: 100 })
//     .withMessage("Artical title too long"),
//   check("description")
//     .notEmpty()
//     .withMessage("Artical description required")
//     .isLength({ min: 10 })
//     .withMessage("Artical description too short, should be at least 10 char"),
//   check("content")
//     .notEmpty()
//     .withMessage("Artical content required")
//     .isLength({ min: 10 })
//     .withMessage("Artical content too short, should be at least 10 char"),
//   check("videoUrl").isString().withMessage("videourl must be a string"),
//   check("imageCover")
//     .notEmpty()
//     .withMessage("Blog image required")
//     .isString()
//     .withMessage("image must be a string"),

//   validatorMiddleware,
// ];

// exports.getOneArticalValidator = [
//   check("id").isMongoId().withMessage("invalid id formate"),
//   validatorMiddleware,
// ];

// exports.updateArticalValidator = [
//   check("id").isMongoId().withMessage("Invalid artical id format"),
//   check("title")
//     .notEmpty()
//     .withMessage("artical title required")
//     .isLength({ min: 2 })
//     .withMessage("artical title too short")
//     .isLength({ max: 100 })
//     .withMessage("artical title too long")
//     .optional(),
//   check("description")
//     .notEmpty()
//     .withMessage("artical description required")
//     .isLength({ min: 10 })
//     .withMessage("artical description too short, should be at least 10 char")
//     .optional(),
//   check("content")
//     .optional()
//     .notEmpty()
//     .withMessage("Artical content required")
//     .isLength({ min: 10 })
//     .withMessage("Artical content too short, should be at least 10 char"),
//   check("videoUrl")
//     .isString()
//     .withMessage("videourl must be a string")
//     .optional(),
//   check("imageCover")
//     .notEmpty()
//     .withMessage("Blog image required")
//     .isString()
//     .withMessage("image must be a string")
//     .optional(),
//   validatorMiddleware,
// ];

// exports.deleteArticalValidator = [
//   check("id").isMongoId().withMessage("invalid id formate"),
//   validatorMiddleware,
// ];















// exports.checkPackageAuthority = async (req, res, next) => {
//   const { packageId } = req.params;
//   const { user } = req;
//   const subscription = await Subscription.findOne({
//     user: user._id,
//     package: packageId,
//   });
//   if (!subscription) {
//     return next(apiError("you are not subscribed", 401));
//   }
//   const bool = new Date(subscription.endDate).getTime() <= new Date().getTime();

//   if (bool) {
//     return next(apiError("your subscription has expired", 401));
//   }
//   return next();
// };
