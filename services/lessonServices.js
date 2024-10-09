const sharp = require("sharp");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Lesson = require("../models/lessonModel");
const CourseProgress = require("../models/courseProgressModel");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");

exports.uploadlessonMedia = uploadMixOfFiles([
  {
    name: "image",
    maxCount: 1,
  },
  {
    name: "attachment",
    maxCount: 1,
  },
]);

exports.resizeMedia = asyncHandler(async (req, res, next) => {
  if (req.files.image && req.files.image[0].mimetype.startsWith("image/")) {
    const imageFileName = `lesson-${uuidv4()}-${Date.now()}.webp`;

    // Convert and save image using sharp
    await sharp(req.files.image[0].buffer)
      .toFormat("webp")
      .webp({ quality: 95 })
      .toFile(`uploads/lessons/images/${imageFileName}`);

    req.body.image = imageFileName; // Save imageCover file name in the request body for database saving
  } else if (req.files.image) {
    return next(new ApiError("Image is not an image file", 400));
  }

  // Handling attachment file upload
  if (req.files.attachment) {
    const file = req.files.attachment[0]; // Assuming there's only one attachment
    const fileExtension = file.originalname.split(".").pop();
    const newFileName = `lessonFile-${uuidv4()}-${Date.now()}.${fileExtension}`;

    if (
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.mimetype)
    ) {
      await fs.writeFile(
        `uploads/lessons/attachments/${newFileName}`,
        file.buffer
      );
      req.body.attachment = newFileName;
    } else {
      return next(
        new ApiError(
          "Unsupported file type. Only PDF and Word documents are allowed.",
          400
        )
      );
    }
  }

  next();
});

exports.setCourseIdToBody = (req, res, next) => {
  // Nested route
  if (!req.body.course) req.body.course = req.params.courseId;
  next();
};
// Create a new lesson
exports.createLesson = factory.createOne(Lesson);
//get lessons in dashboard

exports.getLessons = factory.getALl(Lesson);
// Get all lessons of course for each user & hide the link of the lessons that the user didn't reach yet
exports.getCourseLessons = async (req, res, next) => {
  const lessons = await Lesson.find({ course: req.params.id }).sort({
    order: 1,
  });
  if (lessons.length === 0)
    return next(new ApiError("No lessons found for this course", 404));

  // Define a variable to hold the modified lessons with restricted access as needed
  let accessibleLessons = [...lessons];

  if (req.user.role !== "admin") {
    const userCourseProgress = await CourseProgress.findOne({
      user: req.user._id,
      course: req.params.id,
    }).populate("progress.lesson");

    if (!userCourseProgress || userCourseProgress.progress.length === 0) {
      // If no progress, user should only access the first lesson
      accessibleLessons = lessons.map((lesson, index) => {
        if (index > 0) lesson.videoUrl = undefined;
        return lesson;
      });
    } else {
      // Find the last lesson in progress
      const lastLessonProgress =
        userCourseProgress.progress[userCourseProgress.progress.length - 1];
      let currentLessonOrder;

      if (lastLessonProgress.status === "Completed") {
        // User can proceed to the next lesson
        currentLessonOrder = lastLessonProgress.lesson.order + 1;
      } else {
        // User should retake the last lesson
        currentLessonOrder = lastLessonProgress.lesson.order;
      }

      // Update accessibleLessons based on currentLessonOrder
      accessibleLessons = lessons.map((lesson) => {
        if (lesson.order > currentLessonOrder) lesson.videoUrl = undefined;
        return lesson;
      });
    }
  }

  return res.status(200).json({ status: "success", data: accessibleLessons });
};

// exports.getCourseLessons = async (req, res,next) => {
//   const lessons = await Lesson.find({ course: req.params.id }).sort({
//     order: 1,
//   });
//   if (!lessons)
//     return next(new ApiError("No lessons found for this course", 404));

//   if (req.user.role !== "admin") {
//     // If the user is not an admin, check the user's progress in the course
//     const userCourseProgress = await CourseProgress.findOne({
//       user: req.user._id,
//       course: req.params.id,
//     });
//     if (!userCourseProgress) {
//       return next(new ApiError("No lessons found for this course", 404));
//     }
//     //-------------------check which lesson is available for the user
//     let currentLessonOrder = 0;
//     if (userCourseProgress.progress.length === 0) {
//       currentLessonOrder = lessons[0].order; //first lesson
//     } else {
//       const { lesson } = userCourseProgress.progress[-1]; //last lesson the user took
//       if (lesson.status === "Completed") {
//         currentLessonOrder = lesson.order + 1;
//       } else {
//         currentLessonOrder = lesson.order;
//       }
//     }
//     //------------------------------------------------------------------------------------------------
//     // Remove link attribute from lessons where their order is greater than currentLessonOrder
//     lessons.forEach((lessonObject) => {
//       if (lessonObject.order > currentLessonOrder) {
//         lessonObject.videoUrl = undefined;
//       }
//     });
//   }

//   return res.status(200).json({ status: "success", data: lessons });
// };

// Get a specific lesson by ID
exports.getLessonById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const lesson = await Lesson.findById(id);

  if (!lesson) {
    // If no lesson is found with the given ID, send a 404 response
    return next(new ApiError("No lesson found with that ID", 404));
  }

  return res.status(200).json({ data: lesson });
});

// Update a lesson by ID
exports.updateLesson = factory.updateOne(Lesson);

// Delete a lesson by ID
exports.deleteLesson = factory.deleteOne(Lesson);
