const { body, check } = require("express-validator");
const slugify = require("slugify");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
const Package = require("../../models/packageModel");

exports.createPackageValidator = [
  body("title").isObject().withMessage("Title must be an object."),

  body("title.en")
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`)
    .custom((val, { req }) => {
      req.body.slug = slugify(val);
      return true;
    }),

  body("title.ar")
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description").isObject().withMessage("description must be an object."),

  body("description.en")
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body("description.ar")
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body("highlights").isArray().withMessage("highlights must be an array"),
  body("highlights.*").isObject().withMessage("highlight must be an object"),
  body("highlights.*.en")
    .isString()
    .withMessage(`en highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en highlight must be at least 3 chars`),
  body("highlights.*.ar")
    .isString()
    .withMessage(`ar highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar highlight must be at least 3 chars`),
  //-----------------------------------
  body("whatWillLearn")
    .optional()
    .isArray()
    .withMessage("whatWillLearn must be an array"),
  body("whatWillLearn.*")
    .optional()
    .isObject()
    .withMessage("whatWillLearn must be an object"),
  body("whatWillLearn.*.en")
    .optional()
    .isString()
    .withMessage(`en whatWillLearn must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en whatWillLearn must be at least 3 chars`),
  body("whatWillLearn.*.ar")
    .optional()
    .isString()
    .withMessage(`ar whatWillLearn must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar whatWillLearn must be at least 3 chars`),
  //--------------
  body("coursePrerequisites")
    .optional()
    .isArray()
    .withMessage("coursePrerequisites must be an array"),
  body("coursePrerequisites.*")
    .optional()
    .isObject()
    .withMessage("coursePrerequisites must be an object"),
  body("coursePrerequisites.*.en")
    .optional()
    .isString()
    .withMessage(`en coursePrerequisites must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en coursePrerequisites must be at least 3 chars`),
  body("coursePrerequisites.*.ar")
    .optional()
    .isString()
    .withMessage(`ar coursePrerequisites must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar coursePrerequisites must be at least 3 chars`),
  //--------------
  body("whoThisCourseFor")
    .optional()
    .isArray()
    .withMessage("whoThisCourseFor must be an array"),
  body("whoThisCourseFor.*")
    .optional()
    .isObject()
    .withMessage("whoThisCourseFor must be an object"),
  body("whoThisCourseFor.*.en")
    .optional()
    .isString()
    .withMessage(`en whoThisCourseFor must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en whoThisCourseFor must be at least 3 chars`),
  body("whoThisCourseFor.*.ar")
    .optional()
    .isString()
    .withMessage(`ar whoThisCourseFor must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar whoThisCourseFor must be at least 3 chars`),
  //-----------------------------------
  check("price")
    .notEmpty()
    .withMessage("Package price is required")
    .isNumeric()
    .withMessage("Package price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("Package priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new ApiError("priceAfterDiscount must be lower than price", 400);
      }
      return true;
    }),

  check("course")
    .notEmpty()
    .withMessage("Course is required")
    .isMongoId()
    .withMessage("Invalid course id format")
    .custom(async (value, { req }) => {
      const { res } = req; // Accessing res from req
      const course = await Course.findById(value);
      if (!course) {
        throw new ApiError(res.__("errors.Not-Found"), 403);
      }
      //check if the package with that course is already exist
      const package = await Package.findOne({ course: value });
      if (package) {
        throw new ApiError(res.__("errors.Duplicate"), 400);
      }
      return true;
    }),

  validatorMiddleware,
];

exports.updatePackageValidator = [
  check("id").isMongoId().withMessage("Invalid package id format"),
  body("title").optional().isObject().withMessage("Title must be an object."),

  body("title.en")
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body("title.ar")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description")
    .optional()
    .isObject()
    .withMessage("description must be an object."),

  body("description.en")
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body("description.ar")
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body("highlights")
    .optional()
    .isArray()
    .withMessage("highlights must be an array"),
  body("highlights.*").isObject().withMessage("highlight must be an object"),
  body("highlights.*.en")
    .isString()
    .withMessage(`en highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en highlight must be at least 3 chars`),
  body("highlights.*.ar")
    .isString()
    .withMessage(`ar highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar highlight must be at least 3 chars`),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("package price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("package priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new ApiError("priceAfterDiscount must be lower than price", 400);
      }
      return true;
    }),
  check("course")
    .optional()
    .isMongoId()
    .withMessage("Invalid course id format")
    .custom(async (value) => {
      const course = await Course.findById(value);
      if (!course) {
        throw new ApiError("Course not found", 404);
      }
      //check if the package with that course is already exist
      const package = await Package.findOne({ course: value });
      if (package) {
        throw new ApiError("Package with that course is already exist", 400);
      }
      return true;
    }),
  validatorMiddleware,
];

exports.packageIdValidator = [
  check("id").isMongoId().withMessage("invalid id formate"),
  validatorMiddleware,
];

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
