const { validationResult } = require("express-validator");
const slugify = require("slugify");

// @desc Finds the validation errors in this request and wraps them in an object with handy functions
const validatorMiddleware = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Slugify the error messages and structure the response
    const formattedErrors = errors.array().map(err => ({
      msg: slugify(err.msg, { lower: true, strict: true }), // Slugify message
      param: err.param,
      location: err.location
    }));

    return res.status(400).json({ errors: formattedErrors });
  }

  // If no errors, proceed to the next middleware
  next();
};

module.exports = validatorMiddleware;
