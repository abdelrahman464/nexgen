const { default: mongoose } = require("mongoose");
const _ = require("lodash");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Lesson = require("../models/lessonModel");
const Section = require("../models/sectionModel");
const CourseProgress = require("../models/courseProgressModel");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");
const ApiFeatures = require("../utils/apiFeatures");
const Exam = require("../models/examModel");
const Course = require("../models/courseModel");

exports.uploadFiles = uploadMixOfFiles([
  {
    name: "image",
    maxCount: 1,
  },
  {
    name: "attachments",
    maxCount: 10,
  },
]);

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
};

exports.resizeFiles = asyncHandler(async (req, res, next) => {
  if (req.files && req.files.attachments) {
    const fileProcessingPromises = req.files.attachments.map(
      async (file, index) => {
        const mimeType = file.mimetype;

        // Check if the file is an image or PDF
        if (
          !mimeType.startsWith("image/") &&
          !mimeType.startsWith("application/pdf")
        ) {
          throw new ApiError(
            `File ${index + 1} is not an image or PDF file.`,
            400
          );
        }

        const extension = mimeType.split("/")[1];
        const fileName = `lesson-attachment-${uuidv4()}-${Date.now()}-${index + 1}.${extension}`;
        const filePath = path.join(
          "uploads",
          "lessons",
          "attachments",
          fileName
        );

        ensureDirectoryExistence(filePath);

        try {
          if (mimeType.startsWith("image/")) {
            // Process image files with sharp
            await sharp(file.buffer).webp({ quality: 95 }).toFile(filePath);
          } else if (mimeType.startsWith("application/pdf")) {
            // Save PDF files as-is
            fs.writeFileSync(filePath, file.buffer);
          }

          // Return the filename to store in req.body.attachments
          return fileName;
        } catch (error) {
          console.error(`Error processing file ${index + 1}: ${error.message}`);
          throw new ApiError(`Error processing file ${index + 1}.`, 500);
        }
      }
    );

    try {
      const processedFiles = await Promise.all(fileProcessingPromises);
      req.body.attachments = processedFiles; // Populate req.body.attachments with filenames
    } catch (error) {
      return next(error); // Properly pass error to error handler middleware
    }
  }
  if (req.files && req.files.image) {
    if (!req.files.image[0].mimetype.startsWith("image/")) {
      return next(new ApiError("lesson image is not an image file", 400));
    }

    const imageFileName = `lesson-${uuidv4()}-${Date.now()}-image.webp`;
    await sharp(req.files.image[0].buffer)
      .webp({ quality: 95 })
      .toFile(`uploads/lessons/images/${imageFileName}`);

    req.body.image = imageFileName;
  }

  next();
});

exports.isTheLessonInstructor = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }
  if (req.params.id) {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return next(new ApiError("Lesson not found", 404));
    }
    const course = await Course.findById(lesson.course);
    if (!course) {
      return next(new ApiError("Course not found", 404));
    }
    if (course.instructor.toString() !== req.user._id.toString()) {
      return next(
        new ApiError(`You are not the instructor of this course`, 404)
      );
    }
  } else {
    const course = await Course.findById(req.body.course);
    if (!course) {
      return next(new ApiError("Course not found", 404));
    }
    if (course.instructor.toString() !== req.user._id.toString()) {
      return next(
        new ApiError(`You are not the instructor of this course`, 404)
      );
    }
  }
  next();
};

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
  const query = Lesson.find({ course: req.params.id }).sort({
    order: 1,
  });
  const documentsCount = await Lesson.countDocuments({ course: req.params.id });

  const apiFeatures = new ApiFeatures(query, req.query)
    .filter()
    .search("Lesson")
    .sort()
    .limitFields();

  const results = await apiFeatures.paginate();

  const lessons = Lesson.schema.methods.toJSONLocalizedOnly(
    results,
    req.locale
  );

  const currentPage = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const numberOfPages = Math.ceil(documentsCount / limit);
  let nextPage = null;

  if (currentPage < numberOfPages) {
    nextPage = currentPage + 1;
  }
  if (lessons.length === 0)
    return next(new ApiError("No lessons found for this course", 404));

  // Define a variable to hold the modified lessons with restricted access as needed
  let accessibleLessons = [...lessons];
  let canTakeFinalExam = false;
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
      let lastLessonProgress = this.getLastLessonExamOrder(
        userCourseProgress.progress
      );

      lastLessonProgress = lastLessonProgress.toObject();

      //------------
      let currentLessonOrder = lastLessonProgress.lesson.order || 0;
      const conditions = {
        isCompleted: lastLessonProgress.status === "Completed",
        hasPassedAnalytics: _.has(lastLessonProgress, "passAnalytics")
          ? lastLessonProgress.passAnalytics
          : undefined,
      };

      const canProgressToNextLesson =
        conditions.isCompleted &&
        (conditions.hasPassedAnalytics === undefined ||
          conditions.hasPassedAnalytics);

      if (canProgressToNextLesson) {
        currentLessonOrder += 1;
      }
      //---------------
      // Update accessibleLessons based on currentLessonOrder

      accessibleLessons = lessons.map((lesson) => {
        if (lesson.order > currentLessonOrder) lesson.videoUrl = undefined;
        if (lesson.order < currentLessonOrder) {
          lesson.passedExam = true;
          if (lesson.isRequireAnalytic) lesson.passedAnalyticsTask = true; // check if lesson require analytics (hashMap lessons by order)
        }

        if (lesson.order === currentLessonOrder && !canProgressToNextLesson) {
          lesson.passedExam = conditions.isCompleted;
          if (conditions.hasPassedAnalytics !== undefined) {
            lesson.passedAnalyticsTask = conditions.hasPassedAnalytics;
          }
        } else if (lesson.order === currentLessonOrder) {
          lesson.passedExam = false;
          if (lesson.isRequireAnalytic) lesson.passedAnalyticsTask = false; // check if lesson require analytics (hashMap lessons by order)
        }

        return lesson;
      });

      if (lessons.length < currentLessonOrder) {
        canTakeFinalExam = true;
      }
    }
  }

  return res.status(200).json({
    results: results.length,
    canTakeFinalExam,
    paginationResult: {
      totalCount: documentsCount,
      currentPage,
      limit,
      numberOfPages,
      nextPage,
    },
    data: accessibleLessons,
  });
};

//@desc get lessons of a section
//@route GET /api/v1/lessons/sectionLessons/:id
//@access Private
exports.getSectionLessons = async (req, res, next) => {
  try {
    const lessons = await Lesson.find({ course: req.params.id }).sort({
      order: 1,
    });

    if (lessons.length === 0) {
      return next(new ApiError("No lessons found for this course", 404));
    }

    const localizedLessons = Lesson.schema.methods.toJSONLocalizedOnly(
      lessons,
      req.locale
    );

    // Define a variable to hold the modified lessons with restricted access as needed
    let accessibleLessons = [...localizedLessons];
    let canTakeFinalExam = false;
    if (req.user.role !== "admin") {
      const userCourseProgress = await CourseProgress.findOne({
        user: req.user._id,
        course: req.params.id,
      }).populate("progress.lesson");

      if (!userCourseProgress || userCourseProgress.progress.length === 0) {
        // If no progress, user should only access the first lesson
        accessibleLessons = localizedLessons.map((lesson, index) => {
          if (index > 0) lesson.videoUrl = undefined;
          return lesson;
        });
      } else {
        // Find the last lesson in progress

        let lastLessonProgress = this.getLastLessonExamOrder(
          userCourseProgress.progress
        );
        lastLessonProgress = lastLessonProgress.toObject();

        // Add null checks for lesson and order
        let currentLessonOrder = lastLessonProgress.lesson.order || 0;
        const conditions = {
          isCompleted: lastLessonProgress.status === "Completed",
          hasPassedAnalytics: _.has(lastLessonProgress, "passAnalytics")
            ? lastLessonProgress.passAnalytics
            : undefined,
        };

        const canProgressToNextLesson =
          conditions.isCompleted &&
          (conditions.hasPassedAnalytics === undefined ||
            conditions.hasPassedAnalytics);

        if (canProgressToNextLesson) {
          currentLessonOrder += 1;
        }
        // Update accessibleLessons based on currentLessonOrder
        accessibleLessons = localizedLessons.map((lesson) => {
          if (lesson.order > currentLessonOrder) lesson.videoUrl = undefined;
          if (lesson.order < currentLessonOrder) {
            lesson.passedExam = true;
            if (lesson.isRequireAnalytic) lesson.passedAnalyticsTask = true; // check if lesson require analytics (hashMap lessons by order)
          }

          if (lesson.order === currentLessonOrder && !canProgressToNextLesson) {
            lesson.passedExam = conditions.isCompleted;
            if (conditions.hasPassedAnalytics !== undefined) {
              lesson.passedAnalyticsTask = conditions.hasPassedAnalytics;
            }
          } else if (lesson.order === currentLessonOrder) {
            lesson.passedExam = false;
            if (lesson.isRequireAnalytic) lesson.passedAnalyticsTask = false; // check if lesson require analytics (hashMap lessons by order)
          }
          return lesson;
        });
        if (lessons.length < currentLessonOrder) {
          canTakeFinalExam = true;
        }
      }
    }

    //get all sections in that course
    const sections = await Section.find({ course: req.params.id }).sort({
      order: 1,
    });

    const localizedSections = Section.schema.methods.toJSONLocalizedOnly(
      sections,
      req.locale
    );

    //order lessons by section
    const orderedLessons = [];
    localizedSections.forEach((section) => {
      const sectionLessons = accessibleLessons.filter(
        (lesson) =>
          lesson.section &&
          section._id &&
          lesson.section.toString() === section._id.toString()
      );
      orderedLessons.push({
        section: section.title,
        lessons: sectionLessons,
      });
    });

    return res.status(200).json({
      canTakeFinalExam,
      data: orderedLessons,
    });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
};

//@desc get lessons of a section
//@route GET /api/v1/lessons/sectionLessons/:id/public
//@access Private
exports.getSectionLessonsInPublic = async (req, res, next) => {
  const lessons = await Lesson.find({ course: req.params.id }).sort({
    order: 1,
  });
  const localizedLessons = Lesson.schema.methods.toJSONLocalizedOnly(
    lessons,
    req.locale
  );

  //get all section in that course
  const sections = await Section.find({ course: req.params.id }).sort({
    order: 1,
  });
  const localizedSections = Section.schema.methods.toJSONLocalizedOnly(
    sections,
    req.locale
  );

  //order lessons by section
  const orderedLessons = [];
  localizedSections.forEach((section) => {
    const sectionLessons = localizedLessons.filter(
      (lesson) => lesson.section.toString() === section._id.toString()
    );
    orderedLessons.push({
      section: section.title,
      lessons: sectionLessons,
    });
  });

  return res.status(200).json({
    data: orderedLessons,
  });
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

// Function to generate video data for a specific video ID

async function getVideoData(videoId, user) {
  const url = `https://dev.vdocipher.com/api/videos/${videoId}/otp`;

  // Custom watermark configuration
  const payload = {
    ttl: 3600, // OTP valid for 60 minutes
    // whitelisthref: 'nexgen-academy.com',
    userId: user._id,
    annotate: JSON.stringify([
      {
        type: "rtext",
        text: `${user.idNumber ? user.idNumber : user._id} - ${user.email}`,
        alpha: "0.60",
        color: "#197cf5",
        size: "5",
        interval: "3000",
        x: "10",
        y: "10",
      },
    ]),
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        authorization: `Apisecret ${process.env.VDOCIPHER_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching video data");
    // throw error;
  }
}
// Get a specific lesson by ID
exports.getLessonById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  let videoData = null;
  try {
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      // If no lesson is found with the given ID, send a 404 response
      return next(new ApiError("No lesson found with that ID", 404));
    }

    const localizedLesson = Lesson.schema.methods.toJSONLocalizedOnly(
      lesson,
      req.locale
    );
    if (req.user.role !== "admin") {
      videoData = await getVideoData(lesson.videoUrl, {
        _id: req.user._id,
        email: req.user.email,
        idNumber: req.user.idNumber,
      });
    }
    if (lesson.title) {
      localizedLesson.translationTitle = lesson.title;
    }

    if (lesson.description) {
      localizedLesson.translationDescription = lesson.description;
    }

    return res.status(200).json({
      status: "success",
      data: {
        lesson: localizedLesson,
        videoData,
      },
    });
  } catch (err) {
    console.error(err);
    return next(new ApiError("No lesson found with that ID", 404));
  }
});

// Update a lesson by ID
exports.updateLesson = factory.updateOne(Lesson);

// Delete a lesson by ID
exports.deleteLesson = async (req, res, next) => {
  try {
    await mongoose.connection.transaction(async (session) => {
      // Find the lesson first to check if it exists
      const lesson = await Lesson.findById(req.params.id).session(session);

      // Check if lesson exists
      if (!lesson) {
        return next(
          new ApiError(`Lesson not found for this id ${req.params.id}`, 404)
        );
      }

      // Check if there are exams or course progress associated with this lesson
      const [exam, courseProgress] = await Promise.all([
        Exam.findOne({ lesson: lesson._id }).session(session),
        CourseProgress.findOne({
          "progress.lesson": lesson._id,
        }).session(session),
      ]);

      // If there are associated exams or progress and forceDelete is not true, prevent deletion
      if ((exam || courseProgress) && !req.query.forceDelete) {
        let errorMessage = "";

        if (exam) {
          errorMessage = `There is an exam belongs to this lesson`;
        }

        if (courseProgress) {
          if (errorMessage) {
            errorMessage += "\n";
          }
          errorMessage += `There are students take exam of this lesson`;
        }

        return next(new ApiError(errorMessage, 400));
      }

      // If forceDelete is true, delete associated exams and course progress first
      if (req.query.forceDelete && (exam || courseProgress)) {
        await Promise.all([
          Exam.deleteMany({ lesson: lesson._id }).session(session),
          CourseProgress.updateMany(
            { "progress.lesson": lesson._id },
            { $pull: { progress: { lesson: lesson._id } } }
          ).session(session),
        ]);
      }

      // Now delete the lesson
      await Lesson.findByIdAndDelete(req.params.id).session(session);
    });

    // Return success response
    res.status(204).send();
  } catch (error) {
    // Handle any transaction-related errors
    if (error instanceof ApiError) {
      // Forward specific ApiError instances
      return next(error);
    }
    // Handle other errors with a generic message
    return next(
      new ApiError(`Error during lesson deletion: ${error.message}`, 500)
    );
  }
};

//function to update course progress
// exports.passAnalyticsInCourseProgress = async (userId, lessonId) => {
//   try {
//     //get lesson
//     const lesson = await Lesson.findById(lessonId);

//     const courseProgress = await CourseProgress.findOne({
//       user: userId,
//       course: lesson.course,
//     });

//     if (!courseProgress) {
//       console.log("No course progress found for this user");
//       return;
//     }

//     const lessonIndex = courseProgress.progress.findIndex(
//       (progress) => progress.lesson.toString() === lesson._id
//     );

//     if (lessonIndex === -1) {
//       console.log("No lesson found in course progress");
//       return;
//     }

//     courseProgress.progress[lessonIndex].passAnalytics = true;
//     await courseProgress.save();
//     return;
//   } catch (err) {
//     console.log(err.message);
//   }
// };
//-----------------------------
exports.getLastLessonExamOrder = (progresses) => {
  let lastProgressIndex = 0;
  let lastOrder = 0;

  for (let i = 0; i < progresses.length; i += 1) {
    if (progresses[i].status === "Completed") {
      if (
        !_.isNull(progresses[i].lesson) &&
        progresses[i].lesson.order > lastOrder
      ) {
        lastOrder = progresses[i].lesson.order;
        lastProgressIndex = i;
      }
    }
  }

  return progresses[lastProgressIndex];
};
