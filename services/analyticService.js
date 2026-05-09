const asyncHandler = require('express-async-handler');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');
const Analytic = require('../models/analyticsModel');
const CourseProgress = require('../models/courseProgressModel');
const factory = require('./handllerFactory');
const { uploadMixOfFiles } = require('../middlewares/uploadImageMiddleware');
const Lesson = require('../models/lessonModel');
const _ = require('lodash');
const { checkUserSubscription } = require('./userSubscriptionService');
const Course = require('../models/courseModel');
const User = require('../models/userModel');

exports.uploadMedia = uploadMixOfFiles([
  {
    name: 'media',
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
          'image/jpeg',
          'image/webp',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(file.mimetype)
      ) {
        // Save each file to the uploads directory
        // eslint-disable-next-line no-await-in-loop
        await fs.writeFile(
          path.join('uploads', 'analytics', newFileName),
          file.buffer,
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
          'Unsupported file types provided. Only images, PDF, and Word documents are allowed.',
          400,
        ),
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
exports.checkUserSubscription = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }
    let course = null;
    const { lesson } = req.query;
    if (lesson) {
      if (!mongoose.isValidObjectId(lesson)) {
        return next(new ApiError('Invalid lesson id', 400));
      }
      const courseDoc = await Lesson.findOne({ _id: lesson });
      if (!courseDoc) return next(new ApiError('Lesson not found', 404));
      course = courseDoc.course._id;
    } else if (req.query.course) {
      if (!mongoose.isValidObjectId(req.query.course)) {
        return next(new ApiError('Invalid course id', 400));
      }
      course = req.query.course;
    } else if (req.body.course) {
      course = req.body.course;
    }
    if (!course) {
      return next(new ApiError('course is required', 400));
    }
    await checkUserSubscription(req.user, course);
    return next();
  } catch (err) {
    return next(new ApiError(err.message, 500));
  }
};
//----- filters
//3
exports.filterOnUserRole = asyncHandler(async (req, res, next) => {
  const { course, forceRole } = req.query;

  if (req.user.role === 'admin') {
    if (course && !mongoose.isValidObjectId(course)) {
      return next(new ApiError('Invalid course id', 400));
    }

    req.filterObj = course ? { course } : {};
    req.newQuery = { ...req.query };
    delete req.newQuery.course;
    delete req.newQuery.forceRole;
    return next();
  }

  if (!course) {
    return next(new ApiError('course is required', 400));
  }

  if (!mongoose.isValidObjectId(course)) {
    return next(new ApiError('Invalid course id', 400));
  }

  if (forceRole && !['student', 'marketer', 'instructor'].includes(forceRole)) {
    return next(new ApiError('Invalid forceRole', 400));
  }

  req.filterObj = { course };
  req.newQuery = { ...req.query };
  delete req.newQuery.course;
  delete req.newQuery.forceRole;

  const applyStudentFilter = () => {
    req.filterObj.user = req.user._id;
    return next();
  };

  const applyMarketerFilter = async () => {
    if (!req.user.isMarketer) {
      return next(new ApiError('You are not authorized as marketer', 403));
    }

    const children = await User.find({ invitor: req.user._id }).select('_id');
    req.filterObj.user = { $in: children.map((child) => child._id) };
    return next();
  };

  if (forceRole === 'student') return applyStudentFilter();
  if (forceRole === 'marketer') return applyMarketerFilter();
  if (!forceRole && !req.user.isInstructor && !req.user.isMarketer) {
    return applyStudentFilter();
  }

  const courseDoc = await Course.findById(course)
    .select('_id title instructor')
    .populate('instructor', 'name email');

  if (!courseDoc) {
    return next(new ApiError('Course not found', 404));
  }

  const courseInstructor = courseDoc.instructor;
  const courseInstructorId = courseInstructor?._id || courseInstructor;
  const isCourseInstructor =
    courseInstructorId?.toString() === req.user._id.toString();

  if (!isCourseInstructor) {
    if (!forceRole && req.user.isMarketer) {
      return applyMarketerFilter();
    }

    return next(new ApiError('You are not the instructor of this course', 403));
  }

  return next();
});
//1
exports.filterStatus = async (req, res, next) => {
  //initialize the filter object if not initialized in the previous middleware
  if (_.isObject(req.filterObj) === false) {
    req.filterObj = {};
    req.newQuery = { ...req.query };
  }

  const parseBooleanQuery = (value) => {
    if (value === '1' || value === 'true' || value === true) return true;
    if (value === '0' || value === 'false' || value === false) return false;
    return null;
  };

  if (req.query.isPassed !== undefined) {
    const isPassed = parseBooleanQuery(req.query.isPassed);
    if (isPassed === null) return next(new ApiError('Invalid query', 400));
    req.filterObj.isPassed = isPassed;
    //remove the key from the query
    delete req.newQuery.isPassed;
  }
  // if (req.query.course) {
  //   const lessons = await Lesson.find({ course: req.query.course });
  //   const lessonsIds = lessons.map((lesson) => lesson._id);
  //   req.filterObj.lesson = { $in: lessonsIds };
  //   delete req.newQuery.course;
  // } else if (req.query.lesson) {
  //   req.filterObj.lesson = req.query.lesson;
  //   delete req.newQuery.lesson;
  // }
  if (req.query.isSeen !== undefined) {
    const isSeen = parseBooleanQuery(req.query.isSeen);
    if (isSeen === null) return next(new ApiError('Invalid query', 400));
    req.filterObj.isSeen = isSeen;
    delete req.newQuery.isSeen;
  }
  req.query = req.newQuery;
  return next();
};
//2
exports.assignIds = (req, res, next) => {
  req.body.user = req.user._id;
  req.body.marketer = req.user.coach || null;
  if (!req.body.course && req.query.course) {
    req.body.course = req.query.course;
  }
  next();
};

//----CRUD Operations
//@access : admin
exports.getAll = factory.getALl(Analytic, 'Analytic');
//@access : admin || owner || marketer
exports.getOne = factory.getOne(Analytic);
//assignIds
exports.createOne = async (req, res, next) => {
  const lessonId = req.query.lesson || req.body.lesson;

  if (lessonId) {
    //step 1: check if the lesson exists
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return next(
        new ApiError(res.__('errors.Not-Found', { document: 'lesson' }), 404),
      );
    }
    if (!lesson.course) {
      return next(
        new ApiError(`this lesson don't belong to specific course`, 404),
      );
    }
    //step 2: check if the lesson is required to have an analytic
    const lessonCourseId = lesson.course?._id || lesson.course;
    const userCourseProgress = await CourseProgress.findOne({
      user: req.user._id,
      course: lessonCourseId,
    }).populate('progress.lesson');

    //step 3 update it's course progress object
    let shouldSaveProgress = false;
    let hasLessonProgress = false;
    if (userCourseProgress) {
      userCourseProgress.progress.forEach((obj) => {
        const progressLessonId = obj.lesson?._id || obj.lesson;
        if (progressLessonId?.toString() === lessonId.toString()) {
          obj.passAnalytics = true;
          hasLessonProgress = true;
          shouldSaveProgress = true;
        }
      });

      if (!hasLessonProgress && lesson.isRequireAnalytic && !lesson.hasQuiz) {
        userCourseProgress.progress.push({
          lesson: lesson._id,
          status: 'Completed',
          passAnalytics: true,
          attemptDate: new Date(),
        });
        shouldSaveProgress = true;
      }
    } else if (lesson.isRequireAnalytic && !lesson.hasQuiz) {
      await CourseProgress.create({
        user: req.user._id,
        course: lessonCourseId,
        progress: [
          {
            lesson: lesson._id,
            status: 'Completed',
            passAnalytics: true,
            attemptDate: new Date(),
          },
        ],
      });
    }
    if (shouldSaveProgress) await userCourseProgress.save();
    req.body.lesson = lessonId;
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
        new ApiError(res.__('errors.Not-Found', { document: 'document' }), 404),
      );
    }
    return res.status(200).json({ status: 'success', data: document });
  } catch (error) {
    console.error('Error updating document:', error);
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
  // const [day, month, year] = dateString.split("-").map(Number);
  const [year, month, day] = dateString.split('-').map(Number);
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
  }).select('-__v -updatedAt');

  const result = filterAnalyticsDocs(analyticsDocs, startDate, endDate);
  //get analytics with the same period
  const analyticsCount = analyticsDocs.length;
  return res.status(200).json({
    status: 'success',
    passedAnalyticsCount,
    totalAnalytics: analyticsCount,
    passedDocs: result.passedDocs,
    failedDocs: result.failedDocs,
    analyticsDocs,
  });
};
