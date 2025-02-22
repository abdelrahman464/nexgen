const ErrorLogModel = require("../models/ErrorLogModel");

async function logErrorToDatabase(err) {
  // Replace this with your actual database logging logic
  // For example, using a database library like Mongoose, Sequelize, or a raw query
  const errorLog = {
    name: err.name ? err.name : "Error",
    message: err.message ? err.message : "An error occurred",
    stack: err.stack ? err.stack : "",
    timestamp: new Date(),
  };

  // Example: Using a hypothetical database model
  await ErrorLogModel.create(errorLog);
}

exports.logErrorToDatabase = logErrorToDatabase;
