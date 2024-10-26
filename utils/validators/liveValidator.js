const {  check } = require('express-validator');

exports.createLiveValidator = [
  check('title').notEmpty().withMessage('Title is required'),
  check('description').notEmpty().withMessage('Description is required'),
  check('date')
    .notEmpty()
    .withMessage('Data is required')
    .isDate()
    .withMessage('Invalid Date'),
  check('instructor').isMongoId().withMessage('Invalid id'),
];
