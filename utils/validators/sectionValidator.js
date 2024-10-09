const { check, body } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getSectionValidator = [
  //rules
  check('id').isMongoId().withMessage('Invalid Section id format'),
  //catch error
  validatorMiddleware,
];
exports.createSectionValidator = [
  check('title')
    .notEmpty()
    .withMessage('Section required')
    .isLength({ min: 3 })
    .withMessage('too short Section title')

    .trim(),
  validatorMiddleware,
];
exports.updateSectionValidator = [
  check('id').isMongoId().withMessage('Invalid Section id format'),
  body('title')
    .optional()
    .isLength({ min: 3 })
    .withMessage('too short Section title')
    .trim(),

  validatorMiddleware,
];
exports.deleteSectionValidator = [
  check('id').isMongoId().withMessage('Invalid Section id format'),
  validatorMiddleware,
];
