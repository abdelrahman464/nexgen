const { body, check } = require("express-validator");
const slugify = require("slugify");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");

exports.createCoursePackageValidator = [
  body("title.en")
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`)
    .custom((val, { req }) => {
      req.body.slug = slugify(val);
      return true;
    }),

  body("title.ar")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

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
    .optional()
    .isNumeric()
    .withMessage("Course Package price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("Course priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new Error("priceAfterDiscount must be lower than price");
      }
      return true;
    }),

  //catch error and return it as a response
  validatorMiddleware,
];

exports.updateCoursePackageValidator = [
  check("id").isMongoId().withMessage("Invalid course package id format"),

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



  check("price")
    .optional()
    .isNumeric()
    .withMessage("Course price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("Course priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new ApiError("priceAfterDiscount must be lower than price", 400);
      }
      return true;
    }),

  validatorMiddleware,
];
