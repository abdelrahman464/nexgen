const ApiError = require("../utils/apiError");
const { logErrorToDatabase } = require("../utils/errorLogs");

const sendErrorForDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorForProd = (err, res) => {

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
};

const handleJwtInvalidSignature = () =>
  new ApiError("Invalid token, please login again...", 401);

const handleJwtExpired = () =>
  new ApiError("Expired token, please login again...", 401);

const globalError = async (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error to database with URL
  // try {
  //   const url = req ? `${req.method} ${req.originalUrl || req.url}` : null;
  //   await logErrorToDatabase(err, url);
  // } catch (logError) {
  //   console.error("Failed to log error to database:", logError);
  // }

  if (process.env.NODE_ENV === "development") {
    sendErrorForDev(err, res);
  } else {
    if (err.name === "JsonWebTokenError") err = handleJwtInvalidSignature();
    if (err.name === "TokenExpiredError") err = handleJwtExpired();
    
    // Slugify message in production mode
    sendErrorForProd(err, res);
  }
};

module.exports = globalError;
