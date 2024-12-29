const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const Course = require('../../models/courseModel');
const ApiError = require('../apiError');

exports.getSectionValidator = [
  //rules
  check('id').isMongoId().withMessage('Invalid Section id format'),
  //catch error
  validatorMiddleware,
];
exports.getSectionCourseIdValidator = [
  //rules
  check('courseId').isMongoId().withMessage('Invalid Section id format'),
  //catch error
  validatorMiddleware,
];
exports.createSectionValidator = [
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

  body('course')
    .isMongoId()
    .withMessage('Invalid Course id format')
    .custom((value) =>
      Course.findById(value).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course Not Found ${value}`, 404));
        }
      }),
    ),

  validatorMiddleware,
];
exports.updateSectionValidator = [
  check('id').isMongoId().withMessage('Invalid Section id format'),
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
exports.deleteSectionValidator = [
  check('id').isMongoId().withMessage('Invalid Section id format'),
  validatorMiddleware,
];
