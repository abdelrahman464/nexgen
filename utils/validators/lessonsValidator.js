const asyncHandler = require("express-async-handler");
const { body, check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
// const { checkCourseAccess } = require("./courseValidator");
const Lesson = require("../../models/lessonModel");
const CourseProgress = require("../../models/courseProgressModel");
const Section = require("../../models/sectionModel");
// const UserSubscription = require('../../models/userSubscriptionModel');

exports.createLessonValidator = [
  check("section")
    .notEmpty()
    .withMessage("Section required")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((sectionId) =>
      Section.findById(sectionId).then((section) => {
        if (!section) {
          return Promise.reject(new ApiError(`Section Not Found`, 404));
        }
      })
    ),
  body("title").isObject().withMessage("Title must be an object."),

  body("title.en")
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body("title.ar")
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description").isObject().withMessage("Description must be an object."),
  body("description.en")
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en description must be at least 3 chars`),
  body("description.ar")
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar description must be at least 3 chars`),

  check("course")
    .notEmpty()
    .withMessage("Lesson must be belong to a Course")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course Not Found`, 404));
        }
      })
    ),
  check("lessonDuration").notEmpty().withMessage("Lesson Duration Required"),

  check("videoUrl").notEmpty().withMessage("Lesson videos Required"),
  check("isRequireAnalytic")
    .optional()
    .isBoolean()
    .withMessage("isRequireAnalytic must be a boolean"),
  validatorMiddleware,
];

exports.updateLessonValidator = [
  check("section")
    .optional()
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((sectionId) =>
      Section.findById(sectionId).then((section) => {
        if (!section) {
          return Promise.reject(new ApiError(`Section Not Found`, 404));
        }
      })
    ),

  body("title").optional().isObject().withMessage("Title must be an object."),

  body("title.en")
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body("title.ar")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description")
    .optional()
    .isObject()
    .withMessage("Description must be an object."),
  body("description.en")
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en description must be at least 3 chars`),
  body("description.ar")
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar description must be at least 3 chars`),

  check("course")
    .optional()
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course Not Found`, 404));
        }
      })
    ),
  check("lessonDuration")
    .optional()
    .isNumeric()
    .withMessage("Lesson Duration must be a number"),

  check("videoUrl").notEmpty().withMessage("Lesson videos Required").optional(),
  check("isRequireAnalytic")
    .optional()
    .isBoolean()
    .withMessage("isRequireAnalytic must be a boolean"),
  validatorMiddleware,
];

exports.checkCourseAccess = asyncHandler(async (req, res, next) => {
  const { id: courseId } = req.params; // courseId
  if (req.user.role === "admin") {
    return next();
  }
  const course = await Course.findById(courseId);

  if (!course) {
    return next(new ApiError(res.__("errors.Not-Found"), 403));
  }

  next();
});

exports.checkLessonAccess = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // lessonId
  const { user } = req;
  if (req.user.role === "admin") {
    return next();
  }
  const lesson = await Lesson.findById(id);
  if (!lesson) {
    return next(new ApiError("Lesson Not Found", 403));
  }

  // need to check if user have this course or not
  const courseProgress = await CourseProgress.findOne({
    user: user._id,
    course: lesson.course,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course", 403));
  }

  next();
});

exports.checkLessonExamAccess = async (req, res, next) => {
  const { id } = req.params; //Lesson ID

  const lesson = await Lesson.findById(id);
  if (!lesson) {
    return next(new ApiError("Lesson Not Found", 403));
  }

  const courseProgress = await CourseProgress.findOne({
    user: req.user._id,
    course: lesson.course,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course ", 403));
  }

  req.lesson = lesson;
  req.courseProgress = courseProgress;
  next();
};
