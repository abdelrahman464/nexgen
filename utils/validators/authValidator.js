const { check } = require('express-validator');
const User = require('../../models/userModel');
const MarketLog = require('../../models/MarketingModel');

const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const verifyEmailWithMailboxLayer = require('../verifyEmail');

exports.signupValidator = [
  check('name')
    .notEmpty()
    .withMessage('name required')
    .isLength({ min: 2 })
    .withMessage('too short User name')
    .isLength({ max: 100 })
    .withMessage('too long User name'),
  check('email')
    .notEmpty()
    .withMessage('Email required')
    .isEmail()
    .withMessage('Invalid email address')
    .custom((val) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error('E-mail already in use'));
        }
      }),
    ),
  // check('email')
  //   .notEmpty()
  //   .withMessage('Email Required')
  //   .isEmail()
  //   .withMessage('Invalid Email Address')
  //   .toLowerCase()
  //   .custom((val) =>
  //     verifyEmailWithMailboxLayer(val).then((isValid) => {
  //       if (isValid) {
  //         User.findOne({ email: val }).then((email) => {
  //           if (email) {
  //             throw new Error('E-mail already exists');
  //           }
  //         });
  //       } else {
  //         throw new Error('Invalid email address or email does not exist');
  //       }
  //     }),
  //   ),
  check('password')
    .notEmpty()
    .withMessage('password required')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters')
    .isLength({ max: 32 })
    .withMessage('password must be at least 8 characters')
    .custom((password, { req }) => {
      if (password !== req.body.passwordConfirm) {
        throw new Error('password does not match');
      }
      return true;
    }),
  // check("phone")
  //   .notEmpty()
  //   .withMessage("phone required")
  //   .isMobilePhone()
  //   .withMessage("Phone number must be a real phone number"),
  check('country')
    .notEmpty()
    .withMessage('country required')
    .isLength({ min: 2 })
    .withMessage('too short country name'),
  check('passwordConfirm').notEmpty().withMessage('password required'),
  // check("invitationKey")
  //   .optional()
  //   .custom(
  //     async (val) =>
  //       await MarketLog.findOne({ invitationKeys: val }).then((user) => {
  //         if (!user) {
  //           return Promise.reject(new Error("Invalid invitation key"));
  //         }
  //       })
  //   ),

  
check("invitationKey")
.optional()
.custom(async (val) => {
  if (!val) return true; // Skip validation if `invitationKey` is not provided

  console.log("Checking invitationKey:", val);
  
  const user = await MarketLog.findOne({ invitationKeys: { $in: [val] } });
  
  console.log("User found:", user);
  
  if (!user) {
    throw new Error("Invalid invitation key");
  }

  return true; // Validation passed
}),
  validatorMiddleware,
];

exports.loginValidator = [
  check('email')
    .notEmpty()
    .withMessage('Email required')
    .isEmail()
    .withMessage('Invalid email address'),

  check('password')
    .notEmpty()
    .withMessage('password required')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters')
    .isLength({ max: 32 })
    .withMessage('password must be at least 8 characters'),
  validatorMiddleware,
];
