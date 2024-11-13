const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getCategoryValidator = [
  //rules
  check('id').isMongoId().withMessage('Invalid category id format'),
  //catch error
  validatorMiddleware,
];

exports.createCategoryValidator = [
  body('title').isObject().withMessage('Title must be an object.'),

  body('title.en')
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body('title.ar')
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  validatorMiddleware,
];
exports.updateCategoryValidator = [
  check('id').isMongoId().withMessage('Invalid category id format'),
  body('title').optional().isObject().withMessage('Title must be an object.'),

  body('title.en')
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body('title.ar')
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),
  validatorMiddleware,
];

