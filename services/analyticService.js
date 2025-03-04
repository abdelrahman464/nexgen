const asyncHandler = require("express-async-handler");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs/promises");
const path = require("path");
const ApiError = require("../utils/apiError");
const Analytic = require("../models/analyticsModel");
const CourseProgress = require("../models/courseProgressModel");
const factory = require("./handllerFactory");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");
const Lesson = require("../models/lessonModel");
const _ = require("lodash");

exports.uploadMedia = uploadMixOfFiles([
  {
    name: "media",
    maxCount: 15,
  },
]);

exports.resize = asyncHandler(async (req, res, next) => {
  if (req.files && req.files.media && req.files.media.length) {
    // Initialize an array to store the names of uploaded files
    req.body.media = [];

    // Loop through all files in the 'media' array
    // eslint-disable-next-line no-restricted-syntax
    for (const file of req.files.media) {
      const fileExtension = path.extname(file.originalname);
      const newFileName = `analytic-${uuidv4()}-${Date.now()}${fileExtension}`;

      // Check if the file type is allowed
      if (
        [
          "image/jpeg",
          "image/webp",
          "image/png",
          "image/gif",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(file.mimetype)
      ) {
        // Save each file to the uploads directory
        // eslint-disable-next-line no-await-in-loop
        await fs.writeFile(
          path.join("uploads", "analytics", newFileName),
          file.buffer
        );
        req.body.media.push(newFileName); // Append the new file name to the media array
      } else {
        // If the file type is not allowed, you can choose to stop processing or just skip the file
        // eslint-disable-next-line no-continue
        continue; // Skips adding this file to the uploads, no error thrown for other files
      }
    }

    // If no files were saved and all were skipped due to unsupported types, you may want to handle it
    if (!req.body.media.length) {
      return next(
        new ApiError(
          "Unsupported file types provided. Only images, PDF, and Word documents are allowed.",
          400
        )
      );
    }
  }

  next();
});
// exports.resizeImage = asyncHandler(async (req, res, next) => {
//   // Image processing for imageCover
//   if (
//     req.files.imageCover &&
//     req.files.imageCover[0].mimetype.startsWith("image/")
//   ) {
//     const imageCoverFileName = `analytic-${uuidv4()}-${Date.now()}-cover.webp`;

//     await sharp(req.files.imageCover[0].buffer)
//       .toFormat("webp") // Convert to WebP
//       .webp({ quality: 95 })
//       .toFile(`uploads/analytics/${imageCoverFileName}`);

//     // Save imageCover file name in the request body for database saving
//     req.body.imageCover = imageCoverFileName;
//   } else if (req.files.imageCover) {
//     return next(new ApiError("Image cover is not an image file", 400));
//   }

//   next();
// });
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
  if (req.query.isSeen) {
    req.filterObj.isSeen = req.query.isSeen;
    delete req.newQuery.isSeen;
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
exports.createOne = async (req, res, next) => {
  if (req.body.lesson) {
    //step 1: check if the lesson exists
    const lesson = await Lesson.findById(req.body.lesson);
    if (!lesson) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "lesson" }), 404)
      );
    }
    //step 2: check if the lesson is required to have an analytic
    const userCourseProgress = await CourseProgress.findOne({
      user: req.user._id,
      course: lesson.course._id,
    }).populate("progress.lesson");

    //step 3 update it's course progress object
    let flag = false;
    if (userCourseProgress && userCourseProgress.progress.length !== 0) {
      userCourseProgress.progress.map((obj) => {
        if (obj.lesson._id?.toString() === req.body.lesson.toString()) {
          obj.passAnalytics = true;
          flag = true;
        }
      });
    }
    if (flag) await userCourseProgress.save();
  }

  return factory.createOne(Analytic)(req, res, next);
};
//check if the user is the owner or marketer
exports.updateOne = async (req, res, next) => {
  try {
    if (req.body.isPassed || req.body.marketerComment) {
      req.body.isSeen = true;
    }
    const document = await Analytic.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!document) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "document" }), 404)
      );
    }
    return res.status(200).json({ status: "success", data: document });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: error.message });
  }
};
//check if the user is the owner or marketer
exports.deleteOne = factory.deleteOne(Analytic);

//-------------------------------------------------
/**
 
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
  const [day, month, year] = dateString.split("-").map(Number);
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

  const passedAnalyticsCount = await Analytic.count({
    user: userId,
    isPassed: true,
  });

  const analyticsDocs = await Analytic.find({
    user: userId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).select("-__v -updatedAt");

  const result = filterAnalyticsDocs(analyticsDocs, startDate, endDate);
  //get analytics with the same period
  const analyticsCount = analyticsDocs.length;
  return res.status(200).json({
    status: "success",
    passedAnalyticsCount,
    totalAnalytics: analyticsCount,
    passedDocs: result.passedDocs,
    failedDocs: result.failedDocs,
    analyticsDocs,
  });
};
