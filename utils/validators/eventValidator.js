const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getEventValidator = [
  //rules
  check('id').isMongoId().withMessage('Invalid Event id format'),
  //catch error
  validatorMiddleware,
];

exports.createEventValidator = [
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

  body('description')
    .optional()
    .isObject()
    .withMessage('Description must be an object.'),
  body('description.en')
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en description must be at least 3 chars`),
  body('description.ar')
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar description must be at least 3 chars`),

  body('date').isDate().withMessage(`date must be a date.`),

  body('link').isString().withMessage(`link must be a string.`),

  body('image').isString().withMessage(`image must be a string.`),

  validatorMiddleware,
];
exports.updateEventValidator = [
  check('id').isMongoId().withMessage('Invalid Event id format'),
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
  body('description')
    .optional()
    .isObject()
    .withMessage('Description must be an object.'),
  body('description.en')
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en description must be at least 3 chars`),
  body('description.ar')
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar description must be at least 3 chars`),
  body('date').optional().isDate().withMessage(`date must be a date.`),
  body('link').optional().isString().withMessage(`link must be a string.`),
  body('image').optional().isString().withMessage(`image must be a string.`),

  validatorMiddleware,
];
