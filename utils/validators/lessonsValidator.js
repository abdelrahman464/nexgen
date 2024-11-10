const asyncHandler = require('express-async-handler');
const { body, check } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const ApiError = require('../apiError');
const Course = require('../../models/courseModel');
// const { checkCourseAccess } = require("./courseValidator");
const Lesson = require('../../models/lessonModel');
const CourseProgress = require('../../models/courseProgressModel');
const Section = require('../../models/sectionModel');
const UserSubscription = require('../../models/userSubscriptionModel');

exports.createLessonValidator = [
  check('section')
    .notEmpty()
    .withMessage('Section required')
    .isMongoId()
    .withMessage('Invalid ID format')
    .custom((sectionId) =>
      Section.findById(sectionId).then((section) => {
        if (!section) {
          return Promise.reject(new ApiError(`Section Not Found`, 404));
        }
      }),
    ),
  body('title').isObject().withMessage('Title must be an object.'),

  body('title.en')
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body('title.ar')
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  check('course')
    .notEmpty()
    .withMessage('Lesson must be belong to a Course')
    .isMongoId()
    .withMessage('Invalid ID format')
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course Not Found`, 404));
        }
      }),
    ),
  check('lessonDuration').notEmpty().withMessage('Lesson Duration Required'),

  check('videoUrl').notEmpty().withMessage('Lesson videos Required'),

  validatorMiddleware,
];

exports.updateLessonValidator = [
  check('section')
    .optional()
    .isMongoId()
    .withMessage('Invalid ID format')
    .custom((sectionId) =>
      Section.findById(sectionId).then((section) => {
        if (!section) {
          return Promise.reject(new ApiError(`Section Not Found`, 404));
        }
      }),
    ),

  body('title').optional().isObject().withMessage('Title must be an object.'),

  body('title.en')
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body('title.ar')
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  check('course')
    .optional()
    .isMongoId()
    .withMessage('Invalid ID format')
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course Not Found`, 404));
        }
      }),
    ),
  check('lessonDuration')
    .optional()
    .isNumeric()
    .withMessage('Lesson Duration must be a number'),

  check('videoUrl').notEmpty().withMessage('Lesson videos Required').optional(),
  validatorMiddleware,
];

exports.checkCourseAccess = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // courseId
  const { user } = req;
  if (req.user.role === 'admin') {
    return next();
  }
  const course = await Course.findById(id);
  if (!course) {
    return next(new ApiError(res.__('errors.Not-Found'), 403));
  }

  // need to check if user have this course or not
  const courseProgress = await CourseProgress.findOne({
    user: user._id,
    course: id,
  });

  if (!courseProgress) {
    return next(new ApiError(res.__('errors.Not-Authorized'), 403));
  }

  //check if user have a valid subscription in package of type course
  const userSubscriptions = await UserSubscription.find({
    user: user._id,
  });
  if (!userSubscriptions) {
    return next(new ApiError(res.__('errors.Not-Authorized'), 403));
  }

  userSubscriptions.forEach((subscription) => {
    if (
      subscription.package.type === 'course' &&
      subscription.package.course._id.toString() === course._id.toString()
    ) {
      if (subscription.endDate < new Date()) {
        return next(
          new ApiError('Your Subscription Is Expired Or Not Found', 403),
        );
      }
    }
  });

  next();
});

exports.checkLessonAccess = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // lessonId
  const { user } = req;
  if (req.user.role === 'admin') {
    return next();
  }
  const lesson = await Lesson.findById(id);
  if (!lesson) {
    return next(new ApiError('Lesson Not Found', 403));
  }

  // need to check if user have this course or not
  const courseProgress = await CourseProgress.findOne({
    user: user._id,
    course: lesson.course,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course", 403));
  }

  //check if user have a valid subscription in package of type course
  const userSubscriptions = await UserSubscription.find({
    user: user._id,
  });
  if (!userSubscriptions) {
    return next(new ApiError(res.__('errors.Not-Authorized'), 403));
  }

  userSubscriptions.forEach((subscription) => {
    if (
      subscription.package.type === 'course' &&
      subscription.package.course.toString() === lesson.course.toString()
    ) {
      if (subscription.endDate < new Date()) {
        return next(new ApiError(res.__('errors.Not-Authorized'), 403));
      }
    }
  });

  next();
});

exports.checkLessonExamAccess = async (req, res, next) => {
  const { id } = req.params; //Lesson ID

  const lesson = await Lesson.findById(id);
  if (!lesson) {
    return next(new ApiError('Lesson Not Found', 403));
  }

  const courseProgress = await CourseProgress.findOne({
    user: req.user._id,
    course: lesson.course,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course ", 403));
  }

  // if user takes two exams in one day then prevent him to take more exams
  // if the last two exams were completed in one day, prevent taking another exam on the same day
  const progress = courseProgress.progress
    .filter((p) => p.status === 'passed') // Ensure this matches the actual status value in your data
    .sort((a, b) => new Date(b.attemptDate) - new Date(a.attemptDate)); // Sort by attemptDate in descending order

  if (progress.length >= 2) {
    const lastAttemptDate = progress[0].attemptDate;
    const secondLastAttemptDate = progress[1].attemptDate;

    const isSameDay = (date1, date2) => {
      const d1 = new Date(date1).toISOString().slice(0, 10);
      const d2 = new Date(date2).toISOString().slice(0, 10);
      return d1 === d2;
    };

    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const lastAttemptDateString = lastAttemptDate.toISOString().slice(0, 10);
    const secondLastAttemptDateString = secondLastAttemptDate
      .toISOString()
      .slice(0, 10);

    if (
      isSameDay(currentDate, lastAttemptDateString) &&
      isSameDay(currentDate, secondLastAttemptDateString)
    ) {
      return next(
        new ApiError(
          'You have reached the limit of 2 exams completed in one day',
          403,
        ),
      );
    }
  }

  req.lesson = lesson;
  req.courseProgress = courseProgress;
  next();
};
