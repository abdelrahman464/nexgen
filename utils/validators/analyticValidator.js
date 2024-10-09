const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const User = require("../../models/userModel");
const Analytic = require("../../models/analyticsModel");
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
//------------------------------------------------
exports.canMakeOne = async (req, res, next) => {
  if (!req.user.invitor) {
    return next(new ApiError(`you don't have an invitor`, 404));
  }
  //check if the invitor is a valid user
  const invitor = await User.findById(req.user.invitor);
  if (!invitor) {
    return next(new ApiError(`No invitor for this user`, 404));
  }
  return next();
};
//------------------------------------------------
exports.isAuthorized = async (req, res, next) => {
  const { id } = req.params;
  if (req.user.role === "admin") {
    return next();
  }
  const analytic = await Analytic.findById(id);
  if (!analytic) {
    return next(new ApiError(`No analytic found with this id`, 404));
  }
  if (
    analytic.user.toString() !== req.user._id.toString() && //not owner
    analytic.marketer &&
    analytic.marketer.toString() !== req.user._id.toString() //not marketer
  ) {
    return next(new ApiError(`you are not authorized`, 401));
  }

  return next();
};
