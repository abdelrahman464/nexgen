const asyncHandler = require("express-async-handler");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../utils/apiError");
const Analytic = require("../models/analyticsModel");
const factory = require("./handllerFactory");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");
const _ = require("lodash");

exports.uploadImage = uploadMixOfFiles([
  {
    name: "imageCover",
    maxCount: 1,
  },
]);
exports.resizeImage = asyncHandler(async (req, res, next) => {
  // Image processing for imageCover
  if (
    req.files.imageCover &&
    req.files.imageCover[0].mimetype.startsWith("image/")
  ) {
    const imageCoverFileName = `analytic-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.imageCover[0].buffer)
      .toFormat("webp") // Convert to WebP
      .webp({ quality: 95 })
      .toFile(`uploads/analytics/${imageCoverFileName}`);

    // Save imageCover file name in the request body for database saving
    req.body.imageCover = imageCoverFileName;
  } else if (req.files.imageCover) {
    return next(new ApiError("Image cover is not an image file", 400));
  }

  next();
});
//----- filters
//3
exports.filterOnUserRole = (req, res, next) => {
  //initialize the filter object
  req.filterObj = {};
  //initialize the new query object  ,i will use it to remove the 'asMarketer' key from the query and 'isPassed' key then => req.query = newQuery ,
  //cause req.query is passed in apiFeatures class and i don't want to pass the 'asMarketer' key to the apiFeatures class
  const newQuery = { ...req.query };

  //1-if this key exists in the query then the marketer is trying to get his own analytics
  if (req.query.asMarketer) {
    req.filterObj.marketer = req.params.id;
    //remove the key from the query
    delete newQuery.asMarketer;
  }
  //2-the marketer is trying to get the analytics of his users
  else {
    req.filterObj.user = req.params.id;
  }
  req.newQuery = newQuery;
  return next();
};
//1
exports.filterStatus = (req, res, next) => {
  //initialize the filter object if not initialized in the previous middleware
  if (_.isObject(req.filterObj) === false) {
    req.filterObj = {};
    req.newQuery = { ...req.query };
  }

  if (req.query.isPassed) {
    if (req.query.isPassed === "1" || req.query.isPassed === "true")
      req.filterObj.isPassed = true;
    else if (req.query.isPassed === "0" || req.query.isPassed === "false")
      req.filterObj.isPassed = false;
    else return next(new ApiError("Invalid query", 400));
    //remove the key from the query
    delete req.newQuery.isPassed;
  }
  if (req.query.lesson) {
    req.filterObj.lesson = req.query.lesson;
    delete req.newQuery.lesson;
  }
  if (req.query.user) {
    req.filterObj.user = req.query.user;
    delete req.newQuery.user;
  }
  req.query = req.newQuery;
  return next();
};
//2
exports.assignIds = (req, res, next) => {
  req.body.user = req.user._id;
  req.body.marketer = req.user.invitor || null;
  next();
};

//----CRUD Operations
//@access : admin
exports.getAll = factory.getALl(Analytic);
//@access : admin || owner || marketer
exports.getOne = factory.getOne(Analytic);
//assignIds
exports.createOne = factory.createOne(Analytic);
//check if the user is the owner or marketer
exports.updateOne = factory.updateOne(Analytic);
//check if the user is the owner or marketer
exports.deleteOne = factory.deleteOne(Analytic);

//-------------------------------------------------
/**
 *
 * @param {*} analytics
 *
 * @returns {passedDocs,failedDocs} the number of passed and failed documents
 */
function filterAnalyticsDocs(analytics) {
  let passedDocs = 0;
  let failedDocs = 0;
  analytics.map((analytic) => {
    if (analytic.isPassed) passedDocs += 1;
    else failedDocs += 1;
  });
  return { passedDocs, failedDocs };
}
//---------------------------------------------------
function toISOFormat(dateString) {
  // Parse the input date (MM/DD/YYYY)
  const [day, month, year] = dateString.split("/").map(Number);
  // Create a Date object
  const date = new Date(Date.UTC(year, month - 1, day));
  // Convert to ISO format
  // return date.toISOString();
  return date;
}
//---------------------------------------------------

exports.getAnalyticsPerformance = async (req, res, next) => {
  let { startDate, endDate } = req.query;
  const userId = req.params.id;
  startDate = toISOFormat(startDate);
  endDate = toISOFormat(endDate);

  const analyticsCount = await Analytic.count({
    user: userId,
    isPassed: true,
  });
  if (analyticsCount === 0)
    return next(new ApiError(res.__("analytics-errors.Not-Found"), 404));

  const analyticsDocs = await Analytic.find({
    user: userId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).select("-__v -updatedAt");

  const result = filterAnalyticsDocs(analyticsDocs, startDate, endDate);
  //get analytics with the same period
  return res.status(200).json({
    status: "success",
    totalAnalytics: analyticsCount,
    passedDocs: result.passedDocs,
    failedDocs: result.failedDocs,
    analyticsDocs,
  });
};
