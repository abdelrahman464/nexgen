const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.createArticalValidator = [
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

  body('description').isObject().withMessage('description must be an object.'),

  body('description.en')
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body('description.ar')
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body('content').isObject().withMessage('content must be an object.'),

  body('content.en')
    .isString()
    .withMessage(`en content must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en content must be at least 3 chars`),

  body('content.ar')
    .optional()
    .isString()
    .withMessage(`ar content must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar content must be at least 3 chars`),

  check('videoUrl').isString().withMessage('video url must be a string'),
  check('imageCover')
    .notEmpty()
    .withMessage('Blog image required')
    .isString()
    .withMessage('image must be a string'),

  check('author').notEmpty().withMessage('Author is required').isString(),

  validatorMiddleware,
];

exports.getOneArticalValidator = [
  check('id').isMongoId().withMessage('invalid id formate'),
  validatorMiddleware,
];

exports.updateArticalValidator = [
  check('id').isMongoId().withMessage('Invalid artical id format'),
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
    .withMessage('description must be an object.'),

  body('description.en')
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body('description.ar')
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body('content')
    .optional()
    .isObject()
    .withMessage('content must be an object.'),

  body('content.en')
    .optional()
    .isString()
    .withMessage(`en content must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en content must be at least 3 chars`),

  body('content.ar')
    .optional()
    .isString()
    .withMessage(`ar content must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar content must be at least 3 chars`),
  check('videoUrl')
    .isString()
    .withMessage('videourl must be a string')
    .optional(),
  check('imageCover')
    .notEmpty()
    .withMessage('Blog image required')
    .isString()
    .withMessage('image must be a string')
    .optional(),

  check('author')
    .optional()
    .notEmpty()
    .withMessage('Author is required')
    .isString(),
  validatorMiddleware,
];

exports.deleteArticalValidator = [
  check('id').isMongoId().withMessage('invalid id formate'),
  validatorMiddleware,
];
