const mongoose = require("mongoose");

// Define the schema for the error log
const errorLogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  stack: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    default: null,
  },
  method: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create the ErrorLog model
const ErrorLog = mongoose.model("ErrorLog", errorLogSchema);

module.exports = ErrorLog;
