const slugify = require("slugify");

// @desc This class is responsible for operational errors (errors I can predict)
class ApiError extends Error {
  constructor(message, statusCode) {
    // Slugify the message
    const slugifiedMessage = slugify(message, { lower: true, strict: true });
    
    // Call the parent class constructor with the slugified message
    super(slugifiedMessage);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith(4) ? "fail" : "error";
    // This is an operational error (predictable error)
    this.isOperational = true;
  }
}

module.exports = ApiError;
