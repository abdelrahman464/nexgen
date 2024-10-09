const asyncHandler = require("express-async-handler");
const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
// const { checkCourseAccess } = require("./courseValidator");
const Lesson = require("../../models/lessonModel");
const CourseProgress = require("../../models/courseProgressModel");
const Section = require("../../models/sectionModel");

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
  check("title")
    .isLength({ min: 2 })
    .withMessage("must be at least 2 chars")
    .notEmpty()
    .withMessage("Lesson required"),
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
  check("videoUrl").notEmpty().withMessage("Lesson videos Required"),

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

  check("title")
    .optional()
    .isString()
    .withMessage("string only allowed")
    .trim()
    .escape()
    .isLength({ min: 3 })
    .withMessage("too short title ")
    .isLength({ max: 125 })
    .withMessage("too long title for Lesson"),

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

  check("videoUrl").notEmpty().withMessage("Lesson videos Required").optional(),
  validatorMiddleware,
];

exports.checkCourseAccess = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // courseId
  const { user } = req;
  if (req.user.role === "admin") {
    return next();
  }
  const course = await Course.findById(id);
  if (!course) {
    return next(new ApiError("Course Not Found", 403));
  }

  // need to check if user have this course or not
  const courseProgress = await CourseProgress.findOne({
    user: user._id,
    course: id,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course", 403));
  }

  //check if user can access this course even if he not bought it
  // await checkCourseAccess(user, id);

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

  //check if user can access this course even if he not bought it
  //await checkCourseAccess(user, lesson.course);

  next();
});

exports.checkLessonExamAccess = async (req, res, next) => {
  const userId = req.user._id;
  const { id } = req.params; //Lesson ID

  const lesson = await Lesson.findById(id);
  if (!lesson) {
    return next(new ApiError("Lesson Not Found", 403));
  }

  const courseProgress = await CourseProgress.findOne({
    user: userId,
    course: lesson.course,
  });

  if (!courseProgress) {
    return next(new ApiError("You don't have access to this course ", 403));
  }

  // if user takes two exams in one day then prevent him to take more exams
  // if the last two exams were completed in one day, prevent taking another exam on the same day
  const progress = courseProgress.progress
    .filter((p) => p.status === "passed") // Ensure this matches the actual status value in your data
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
          "You have reached the limit of 2 exams completed in one day",
          403
        )
      );
    }
  }

  req.lesson = lesson;
  req.courseProgress = courseProgress;
  next();
};
