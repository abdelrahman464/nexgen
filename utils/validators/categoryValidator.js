const { check, body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Category = require("../../models/categoryModel");

exports.getCategoryValidator = [
  //rules
  check("id").isMongoId().withMessage("Invalid category id format"),
  //catch error
  validatorMiddleware,
];
exports.createCategroyValidator = [
  check("title")
    .notEmpty()
    .withMessage("category required")
    .isLength({ min: 3 })
    .withMessage("too short category titel")
    .isLength({ max: 32 })
    .withMessage("too long category titel")
    .custom((val) =>
      Category.findOne({ title: val }).then((category) => {
        if (category) {
          throw new Error(
            `category title already exists and must it to be unique`
          );
        }
      })
    ),

  validatorMiddleware,
];
exports.updateCategroyValidator = [
  check("id").isMongoId().withMessage("Invalid category id format"),
  body("title")
    .optional()
    .isLength({ min: 3 })
    .withMessage("too short category titel")
    .isLength({ max: 32 })
    .withMessage("too long category titel"),

  validatorMiddleware,
];
exports.deleteCategroyValidator = [
  check("id").isMongoId().withMessage("Invalid category id format"),
  validatorMiddleware,
];
