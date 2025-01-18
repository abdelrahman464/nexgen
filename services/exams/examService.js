const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../../utils/apiError");
const Exam = require("../../models/examModel");
const CourseProgress = require("../../models/courseProgressModel");
const Lesson = require("../../models/lessonModel");
const Course = require("../../models/courseModel");
const User = require("../../models/userModel");
const Notification = require("../../models/notificationModel");
const factory = require("../handllerFactory");
const { uploadMixOfFiles } = require("../../middlewares/uploadImageMiddleware");
const {
  checkUserProgress,
  fetchExam,
  excludeCorrectOptions,
  calculateScore,
  getTotalPossibleGrade,
  hasPassed,
  // updateUserProgress,
  handleExamResponse,
  getTotalGrades,
} = require("./examUtils");
const _ = require("lodash");

// Middleware to upload question image and options images-------------
exports.uploadQuestionAndOptions = uploadMixOfFiles([
  {
    name: "questionImage",
    maxCount: 1,
  },
  {
    name: "options",
    maxCount: 6,
  },
]);
// Image processing middleware
exports.processQuestionImages = asyncHandler(async (req, res, next) => {
  if (
    req.files.questionImage &&
    req.files.questionImage[0].mimetype.startsWith("image/")
  ) {
    const questionImageFileName = `questions-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.questionImage[0].buffer)
      .toFormat("webp")
      .webp({ quality: 95 })
      .toFile(`uploads/questions/${questionImageFileName}`);

    req.body.questionImage = questionImageFileName;
  } else if (req.files.questionImage) {
    return next(new ApiError("Question image is not an image file", 400));
  }

  if (req.files.options) {
    const imageProcessingPromises = req.files.options.map(
      async (img, index) => {
        if (!img.mimetype.startsWith("image/")) {
          return next(
            new ApiError(`Option ${index + 1} is not an image file.`, 400)
          );
        }

        const imageName = `option-${uuidv4()}-${Date.now()}-${index + 1}.webp`;

        await sharp(img.buffer)
          .toFormat("webp")
          .webp({ quality: 95 })
          .toFile(`uploads/questions/options/${imageName}`);

        return imageName;
      }
    );

    req.body.options = await Promise.all(imageProcessingPromises);
  }

  next();
});
// Middleware to check if the user has access to the exam----------------
exports.createFilterObj = (examType) => async (req, res, next) => {
  let filterObject = {};

  switch (examType) {
    case "course":
      filterObject = { course: req.params.courseId, type: "course" };
      break;
    case "lesson":
      filterObject = { lesson: req.params.lessonId, type: "lesson" };
      break;
    case "placement":
      filterObject = { course: req.params.courseId, type: "placement" };
      break;
    default:
      return next(new ApiError("Invalid exam type", 400));
  }

  req.filterObj = filterObject;
  console.log("filterObject", filterObject);
  next();
};

//Basic CRUD------------------------------------------------------------
exports.createExam = asyncHandler(async (req, res, next) => {
  const { lesson, course, model, passingScore, type } = req.body;

  let exam = {};
  // Create exam document
  if (type === "lesson") {
    const existExam = await Exam.findOne({ lesson, model });
    if (existExam) {
      return next(
        new ApiError(
          `Exam already exists for this lesson with Model ${model}`,
          400
        )
      );
    }
    exam = await Exam.create({
      lesson,
      model,
      passingScore,
      type,
    });
  } else if (type === "course" || type === "placement") {
    const existExam = await Exam.findOne({ course, model, type });
    if (existExam) {
      return next(
        new ApiError(
          `Exam already exists for this course with Model ${model}`,
          400
        )
      );
    }

    exam = await Exam.create({
      course,
      model,
      passingScore,
      type,
    });
  }

  res.status(201).json({
    status: "success",
    data: {
      exam,
    },
  });
});
exports.getExams = factory.getALl(Exam);

exports.getExam = factory.getOne(Exam);

exports.deleteExam = factory.deleteOne(Exam);
//Questions Management------------------------------------------------
exports.addQuestionToExam = asyncHandler(async (req, res, next) => {
  const { examId } = req.params;
  const { question, questionImage, options, correctOption, grade } = req.body;

  const newQuestion = {
    question,
    options,
    correctOption,
    grade,
  };

  // If there's a question image, include it
  if (questionImage) {
    newQuestion.questionImage = questionImage;
  }

  // Update the exam document with the new question
  const updatedExam = await Exam.findByIdAndUpdate(
    examId,
    { $push: { questions: newQuestion } },
    { new: true, safe: true, upsert: true }
  );

  if (!updatedExam) {
    return next(new ApiError("Exam not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      exam: updatedExam,
    },
  });
});

exports.updateQuestionInExam = asyncHandler(async (req, res, next) => {
  const { examId, questionId } = req.params; // Assuming you're passing questionId as a URL parameter
  const updateData = req.body; // Includes questionText, questionImage, options, correctOption, grade

  // Prepare the update object dynamically based on the provided updateData
  const update = {};
  Object.keys(updateData).forEach((key) => {
    update[`questions.$[elem].${key}`] = updateData[key];
  });

  // Use updateOne with the arrayFilters option to specify which question to update
  const result = await Exam.updateOne(
    { _id: examId },
    { $set: update },
    {
      arrayFilters: [{ "elem._id": questionId }], // Specify the condition to identify the correct question to update
      new: true, // Return the updated document
    }
  );

  if (result.matchedCount === 0) {
    return next(new ApiError("Exam not found", 404));
  }

  if (result.modifiedCount === 0) {
    return next(new ApiError("Question not found or no update made", 404));
  }

  // Since updateOne doesn't return the updated document, we fetch it to return in response
  const updatedExam = await Exam.findById(examId);

  res.status(200).json({
    status: "success",
    data: updatedExam,
  });
});

exports.removeQuestionsFromExam = asyncHandler(async (req, res, next) => {
  const { examId, questionId } = req.params;
  const exam = await Exam.findByIdAndUpdate(
    examId,
    { $pull: { questions: { _id: questionId } } },
    { new: true }
  );

  if (!exam) {
    return next(new ApiError("Exam not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Question removed successfully",
    data: exam.questions,
  });
});

//get user progress in course
//-------------
exports.getCourseProgress = asyncHandler(async (req, res, next) => {
  const { courseId, userId } = req.params;
  const courseProgress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  if (!courseProgress) {
    return next(new ApiError("Course progress not found", 404));
  }

  const localizedCourseProgress =
    CourseProgress.schema.methods.toJSONLocalizedOnly(
      courseProgress,
      req.locale
    );
  res.status(200).json({ status: "success", data: localizedCourseProgress });
});
//--------------------------------------------------
//@route   GET /getLessonPerformance/:userId/:lessonId
//@desc    Get lesson Questions and user performance
//@access  Private(owner || admin)
exports.getLessonPerformance = asyncHandler(async (req, res, next) => {
  const { userId, lessonId } = req.params;

  const courseProgress = await CourseProgress.findOne({
    user: userId,
    "progress.lesson": lessonId,
  });

  if (!courseProgress) {
    return next(new ApiError("Course progress not found", 404));
  }
  const { progress } = courseProgress;
  // res.json({ status: "success", data: courseProgress });
  const lessonExamResult = _.find(
    progress,
    (p) => _.get(p, "lesson._id")?.toString() === lessonId
  );
  //return Lesson_exam_object
  // console.log(lessonExamResult);
  if (!lessonExamResult) {
    return next(new ApiError("Lesson progress not found", 404));
  }
  // console.log(lessonExamResult);
  const lessonQuestions =
    await this.checkLessonQuestionsStatus(lessonExamResult);

  return res.status(200).json({ status: "success", lessonQuestions });
});
//--------------------------------------------------
//@route   ----
//@desc    check Lesson Questions Status whether it is correct or not , if not add property wrongAnswer that inform client if it is wrong
//@access  internal function
exports.checkLessonQuestionsStatus = async (lessonExamResult) => {
  // Get all questions of this lesson
  const lessonExam = await Exam.findOne({
    lesson: lessonExamResult.lesson._id,
    model: lessonExamResult.modelExam,
  }).select("questions");
  // Convert each question to a plain JavaScript object
  //This allows you to freely add new properties
  const lessonExamQuestions = lessonExam.questions.map((question) =>
    question.toObject()
  );

  // Iterate over questions and find wrong answered question
  lessonExamQuestions.forEach((question) => {
    const wrongAnsweredQuestion = lessonExamResult.wrongAnswers.find(
      (ans) => ans.question.toString() === question._id.toString()
    );
    if (wrongAnsweredQuestion) {
      question.wrongAnswer = wrongAnsweredQuestion.answer;
    }
  });
  return lessonExamQuestions;
  // Continue with the rest of the code...
};
//--------------------------------------------------
//@route   GET /getLessonPerformance/:userId/:lessonId
//@desc    Get lesson Questions and user performance
//@access  Private(owner || admin)
exports.getCoursePerformance = asyncHandler(async (req, res, next) => {
  const { userId, courseId } = req.params;

  const courseExamResult = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  if (!courseExamResult) {
    return next(new ApiError("course's exam result not found", 404));
  }

  if (!courseExamResult.modelExam) {
    return next(new ApiError("You didn't take final exam", 404));
  }

  const lessonQuestions =
    await this.checkCourseQuestionsStatus(courseExamResult);

  return res.status(200).json({ status: "success", lessonQuestions });
});
//@route   ----
//@desc    check Course Questions Status whether it is correct or not , if not add property wrongAnswer that inform client if it is wrong
//@access  internal function
exports.checkCourseQuestionsStatus = async (courseExamResult) => {
  //check on course and model
  // Get all questions of this lesson
  const courseExam = await Exam.findOne({
    course: courseExamResult.course,
    model: courseExamResult.modelExam,
  }).select("questions");
  console.log("courseExam", courseExam);
  // Convert each question to a plain JavaScript object
  //This allows you to freely add new properties
  const courseExamQuestions = courseExam.questions.map((question) =>
    question.toObject()
  );

  // Iterate over questions and find wrong answered question
  courseExamQuestions.forEach((question) => {
    const wrongAnsweredQuestion = courseExamResult.wrongAnswers.find(
      (ans) => ans.question.toString() === question._id.toString()
    );
    if (wrongAnsweredQuestion) {
      question.wrongAnswer = wrongAnsweredQuestion.answer;
    }
  });
  return courseExamQuestions;
  // Continue with the rest of the code...
};

/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
/******************************************************************** */

//Lesson Exam Logic
const getLessonExam = async (lesson, courseProgress, user) => {
  //NOTE !!! : i commented it because dawwod deleted some lessons , so last lessonProgress may be for deleted lesson and cause error
  // await checkUserProgress(user, lesson.course, lesson.order);

  // Determine exam model based on user's previous progress
  const lastProgress =
    courseProgress.progress[courseProgress.progress.length - 1];
  let examModelType = "A";
  if (lastProgress && lastProgress.status === "failed") {
    const modelBExists = await Exam.exists({
      lesson: lesson._id,
      model: "B",
    });
    if (modelBExists) {
      if (lastProgress.modelExam === "A") {
        examModelType = "B";
      } else {
        examModelType = "A";
      }
    } else {
      examModelType = "A";
    }
  }

  const exam = await fetchExam({
    id: lesson._id,
    type: "lesson",
    model: examModelType,
  });
  if (!exam) throw new ApiError("No exam found for this lesson", 404);

  return excludeCorrectOptions(exam);
};

//Course Exam Logic
const getCourseExam = async (req) => {
  const { user, params } = req;
  const examResult = await CourseProgress.findOne({
    user: user._id,
    course: params.id,
  });
  if (!examResult) {
    throw new ApiError(
      "You must purchase course before taking the final exam",
      401
    );
  }
  if (examResult.progress.length === 0) {
    throw new ApiError(
      "You must complete all lesson's exam before taking the final exam",
      401
    );
  }

  if (examResult.status === "Completed")
    throw new ApiError("You have already completed this course", 401);
  //1- checking if the last exam is completed
  const lastProgress = examResult.progress[examResult.progress.length - 1];

  if (lastProgress.status !== "Completed")
    throw new ApiError(
      "You must complete all lessons before taking the exam",
      401
    );
  //2- checking if the last progress is the last lesson in the course
  const lastLesson = await Lesson.findOne({ course: params.id }).sort({
    order: -1,
  });

  if (lastLesson._id.toString() !== lastProgress.lesson._id.toString()) {
    throw new ApiError(
      "You must complete all lessons before taking the exam",
      401
    );
  }

  let examModelType = "A";
  if (examResult.status === "failed" && examResult.modelExam === "B") {
    examModelType = "B";
  }

  const exam = await fetchExam({
    id: params.id,
    type: "course",
    model: examModelType,
  });
  if (!exam) throw new ApiError("No exam found for this course", 404);

  return excludeCorrectOptions(exam);
};

//Placement Exam Logic
const getPlacementExam = async (req) => {
  const { user, params } = req;
  const courseId = params.id;

  const placementExam = await Exam.findOne({
    course: courseId,
    type: "placement",
  });
  if (!placementExam)
    throw new ApiError("No placement exam found for this course", 404);

  let modelExamType = "A";
  if (user.placementExam && user.placementExam.status === "failed") {
    modelExamType = user.placementExam.modelExam === "A" ? "B" : "A";
  }

  const exam = await fetchExam({
    id: courseId,
    type: "placement",
    model: modelExamType,
  });
  if (!exam) throw new ApiError("No exam found for this course", 404);

  return excludeCorrectOptions(exam);
};

/******************************************************************** */
// middlewares
/******************************************************************** */

///////////////////////////////////////////////////////////////////////////
//start lesson exam logic
exports.lessonExam = async (req, res, next) => {
  try {
    const { lesson, courseProgress, user } = req;
    const exam = await getLessonExam(lesson, courseProgress, user);
    res.status(200).json({ status: "success", exam });
  } catch (error) {
    next(error);
  }
};

exports.submitLessonAnswers = async (req, res, next) => {
  const { id } = req.params;
  const { answers } = req.body;
  const { user } = req;

  try {
    // Fetch the exam and lesson
    const exam = await Exam.findOne({ _id: id, type: "lesson" });
    if (!exam) {
      return next(new ApiError("Exam not found", 404));
    }
    const lesson = await Lesson.findById(exam.lesson);
    if (!lesson) {
      return next(new ApiError("Lesson not found", 404));
    }

    // Check if the user has already completed the lesson
    const existingProgress = await CourseProgress.findOne({
      user: user._id,
      course: lesson.course,
    });

    //get last progress
    // const lastProgress =existingProgress.progress[existingProgress.progress.length - 1];

    // Calculate the score and determine if passed
    const examResult = calculateScore(exam.questions, answers);
    const totalPossibleGrade = getTotalPossibleGrade(exam.questions);
    const passed = hasPassed(
      examResult.score,
      totalPossibleGrade,
      exam.passingScore
    );

    // Create new progress entry
    const newProgress = {
      lesson: lesson._id,
      modelExam: exam.model,
      status: passed ? "Completed" : "failed",
      passAnalytics: lesson.isRequireAnalytic ? false : null,
      examScore: examResult.score,
      attemptDate: new Date(),
      wrongAnswers: examResult.wrongAnswers.map((wa) => ({
        question: wa.questionId,
        answer: wa.answer,
      })),
    };

    // Update course progress

    await CourseProgress.findByIdAndUpdate(
      existingProgress._id,
      {
        $push: { progress: newProgress },
      },
      { new: true }
    );

    // Respond with exam results
    return handleExamResponse(
      res,
      passed,
      examResult.score,
      totalPossibleGrade
    );
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
};
//end lesson exam logic
///////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////
//start course exam logic
exports.courseExam = async (req, res, next) => {
  try {
    const exam = await getCourseExam(req);
    res.status(200).json({ status: "success", exam });
  } catch (error) {
    next(error);
  }
};
exports.submitCourseAnswers = async (req, res, next) => {
  try {
    const { id } = req.params; // exam ID
    const { answers } = req.body;
    const adminId = mongoose.Types.ObjectId("66447ad7a7957a07c0ae9e69");

    const exam = await Exam.findById(id);
    if (!exam) {
      return next(new ApiError("Exam not found", 404));
    }

    const course = await Course.findById(exam.course);
    if (!course) {
      return next(new ApiError("Course not found", 404));
    }

    // const localizedCourse = Course.schema.methods.toJSONLocalizedOnly(
    //   course,
    //   req.locale,
    // );

    // Check if the user has already completed the course
    let existingProgress = await CourseProgress.findOne({
      user: req.user._id,
      course: exam.course,
    });
    if (existingProgress && existingProgress.status === "Completed") {
      return next(new ApiError("You have already passed this exam.", 400));
    }

    // Calculate the score and determine if passed
    const examResult = calculateScore(exam.questions, answers);
    const totalPossibleGrade = getTotalPossibleGrade(exam.questions);

    const passed = hasPassed(
      examResult.score,
      totalPossibleGrade,
      exam.passingScore
    );

    // Update course progress
    const updateData = {
      modelExam: exam.model,
      status: passed ? "Completed" : "failed",
      score: examResult.score,
      attemptDate: Date.now(),
      wrongAnswers: examResult.wrongAnswers,
    };
    if (existingProgress) {
      existingProgress = await CourseProgress.findOneAndUpdate(
        { user: req.user._id, course: exam.course },
        { $set: updateData },
        { new: true, upsert: true }
      );
    } else {
      updateData.user = req.user._id;
      updateData.course = exam.course;
      existingProgress = await CourseProgress.create(updateData);
    }
    // Fetch user's completed lessons
    const completedLessons = existingProgress.progress.filter(
      (item) => item.status === "Completed"
    );

    // Fetch Possible grades for completed lessons
    const possibleLessonExamsGrade = await getTotalGrades(completedLessons); // Make sure getTotalGrades works and returns { lessonId, grade }

    // Calculate total exam score user has achieved
    const totalExamScore =
      completedLessons.reduce((total, item) => total + item.examScore, 0) || 0;

    // Calculate total possible lessons exams score
    const totalPossibleLessonExamsGrade = possibleLessonExamsGrade.reduce(
      (total, item) => total + item.grade,
      0
    );

    // Calculate totalCourseExamsPercentage
    const totalCourseExamsPercentage = (
      ((totalExamScore + examResult.score) /
        (totalPossibleLessonExamsGrade + totalPossibleGrade)) *
      100
    ).toFixed(2);

    // Check if the user deserves a certificate
    if (totalCourseExamsPercentage >= 90 && passed) {
      await CourseProgress.findOneAndUpdate(
        { user: req.user._id, course: exam.course },
        { $set: { "certificate.isDeserve": true } }
      );
      await Notification.create({
        user: req.user._id,
        course: course._id,
        type: "certificate",
        message: {
          en: `You have earned a certificate for the course ${course.title.en}. Please wait for the admin to issue it.`,
          ar: ` انتظر حتي تصدرها اداره الموقع.${course.title.ar} لقد حصلت علي شهاده للدروه `,
        },
      });
      await Notification.create({
        user: adminId,
        course: course._id,
        type: "certificate",
        message: {
          en: `User ${req.user.name} has earned a certificate for the course ${course.title.en}. Please issue it.`,
          ar: `يرجي اصدارها في اقرب وقت ${course.title.en} حصل علي شهاده للدروه  ${req.user.name} المستخدم`,
        },
      });
    }

    // Respond with success or failure message
    return handleExamResponse(
      res,
      passed,
      examResult.score,
      totalPossibleGrade
    );
  } catch (err) {
    return res.status(400).json({ status: "error", message: err.message });
  }
};

//end course exam logic
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// start placement exam logic
exports.placementExam = async (req, res, next) => {
  try {
    const exam = await getPlacementExam(req);
    res.status(200).json({ status: "success", exam });
  } catch (error) {
    next(error);
  }
};

exports.submitCoursePlacementAnswers = async (req, res, next) => {
  const { id } = req.params;
  const { answers } = req.body;
  const { user } = req;

  // Fetch the exam
  const exam = await Exam.findById(id);
  if (!exam) {
    return next(new ApiError("Exam not found", 404));
  }

  // Check if user has already failed this exam
  if (
    user.placementExam.status === "failed" &&
    exam.model === user.placementExam.modelExam
  ) {
    return next(new ApiError("You have already failed this exam.", 400));
  }

  // Calculate the score and determine if passed
  const examResult = calculateScore(exam.questions, answers);
  const totalPossibleScore = getTotalPossibleGrade(exam.questions);
  const passed = hasPassed(
    examResult.score,
    totalPossibleScore,
    exam.passingScore
  );

  // Update user's placement exam progress
  await User.findOneAndUpdate(
    { _id: user._id },
    {
      $set: {
        placementExam: {
          exam: exam._id,
          score: examResult.score,
          status: passed ? "Completed" : "failed",
          course: exam.course,
          attemptDate: Date.now(),
          wrongAnswers: examResult.wrongAnswers,
        },
      },
    },
    { new: true }
  );

  // Respond with success or failure message
  return handleExamResponse(res, passed, examResult.score, totalPossibleScore);
};
// end placement exam logic
///////////////////////////////////////////////////////////////////

//@desc Get user scores in a course
//@route GET /api/v1/exams/userScore/:courseId/:userId
// @access Private
exports.userScores = async (req, res, next) => {
  try {
    // const locales = req.locale;
    // console.log('locales', locales);

    const { courseId, userId } = req.params;

    if (!userId) {
      return next(new ApiError("User not found", 404));
    }

    // Fetch the user's course progress
    const courseProgress = await CourseProgress.findOne({
      user: userId,
      course: courseId,
    }).populate("progress.lesson", "title order");

    if (!courseProgress) {
      // return next(new ApiError('No course progress found for this user.', 404));
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "course" }), 404)
      );
    }

    const localizedCourseProgress =
      CourseProgress.schema.methods.toJSONLocalizedOnly(
        courseProgress,
        req.locale
      );
    // Fetch all lessons associated with the course
    const allLessons = await Lesson.find(
      { course: courseId },
      "_id title order"
    );
    const completedLessons = [];
    const seenIds = new Set();
    // Filter completed lessons and calculate total exam score
    localizedCourseProgress.progress.forEach((item) => {
      if (
        !_.isNull(item.lesson) &&
        item.status === "Completed" &&
        !seenIds.has(item._id)
      ) {
        completedLessons.push(item);
        seenIds.add(item._id);
      }
    });
    const completedLessonsCount = completedLessons.length;

    // Fetch Possible grades for completed lessons
    const possibleLessonExamsGrade = await getTotalGrades(completedLessons); // Make sure getTotalGrades works and returns { lessonId, grade }
    // Calculate total exam score user has got
    const totalExamScore =
      completedLessons.reduce((total, item) => total + item.examScore, 0) || 0;
    // Calculate total possible lessons exams score
    const totalPossibleLessonExamsGrade = possibleLessonExamsGrade.reduce(
      (total, item) => total + item.grade,
      0
    );

    //calculate the percentage of completed lessons exams
    const totalLessonsExamsPercentage =
      ((totalExamScore / totalPossibleLessonExamsGrade) * 100).toFixed(2) || 0;

    // Calculate the percentage for each lesson
    const lessonsScores = completedLessons.map((item) => {
      // Find the corresponding total possible score for the lesson
      const possibleExam = possibleLessonExamsGrade.find(
        (exam) => exam.lessonId.toString() === item.lesson._id.toString()
      );

      // Calculate the percentage: (obtained score / possible score) * 100
      const percentage =
        possibleExam && possibleExam.grade
          ? ((item.examScore / possibleExam.grade) * 100).toFixed(2)
          : 0;

      return {
        lessonId: item.lesson._id,
        lessonTitle: item.lesson.title,
        percentage: percentage,
        attemptDate: item.attemptDate,
        modelExam: item.modelExam,
      };
    });

    const lessonExamsAttemptedCount = completedLessonsCount; // Since only completed lessons are attempted

    // Track attempted lesson IDs
    const attemptedLessonIds = new Set(
      completedLessons.map((item) => item.lesson._id.toString())
    );

    // Calculate the number of lessons not attempted
    const notAttemptedLessonsCount = allLessons.filter(
      (lesson) => !attemptedLessonIds.has(lesson._id.toString())
    ).length;

    const totalLessons = allLessons.length;

    // Calculate the total possible course score (assuming each lesson's score is out of 100)
    // const totalPossibleCourseScore = totalLessons * 100;

    // Calculate the average lesson grade for completed lessons
    // const averageLessonExamGrade =
    //   lessonExamsAttemptedCount > 0
    //     ? (totalExamScore / lessonExamsAttemptedCount).toFixed(2)
    //     : 0;
    // const averageGrade =
    //   (
    //     (totalExamScore + courseProgress.score) /
    //     (lessonExamsAttemptedCount + 1)
    //   ).toFixed(2) || 0;

    // Calculate the percentages of exams completed and not attempted
    const examsCompletedPercentage = (
      (completedLessonsCount / totalLessons) *
      100
    ).toFixed(2);
    const examsNotAttemptedPercentage = (
      (notAttemptedLessonsCount / totalLessons) *
      100
    ).toFixed(2);

    // Final exam score and percentage (adjust based on your data structure)
    const finalExamScore = courseProgress.score || 0;

    let finalExam = {};
    //check on the course exam model
    if (courseProgress.modelExam) {
      //get the course finale exam
      finalExam = await Exam.findOne({
        course: courseProgress.course,
        model: courseProgress.modelExam,
      });
    }
    finalExam = await Exam.findOne({
      course: courseProgress.course,
    });
    const finalExamGrade = getTotalPossibleGrade(finalExam.questions);

    // Calculate the finale exam grade percentage
    const finalExamPercentage =
      ((finalExamScore / finalExamGrade) * 100).toFixed(2) || 0;

    const courseScore = {
      finalExamPercentage,
      attemptDate: courseProgress.attemptDate,
      modelExam: courseProgress.modelExam,
    };

    const finalExamCompletionPercentage =
      courseProgress.status === "Completed" ? 100 : 0;

    //calculate the total percentage of the total course exams

    const totalCourseExamsPercentage = (
      ((totalExamScore + finalExamScore) /
        (totalPossibleLessonExamsGrade + (finalExamGrade || 0))) *
      100
    ).toFixed(2);

    // Calculate the total progress with weighted averages (lesson exams 80%, final exam 20%)
    const lessonExamsWeight = 0.8;
    const finalExamWeight = 0.2;
    const totalProgress = (
      examsCompletedPercentage * lessonExamsWeight +
      finalExamCompletionPercentage * finalExamWeight
    ).toFixed(2);

    // Determine the completion status of the course
    const completionStatus =
      completedLessonsCount === totalLessons &&
      finalExamCompletionPercentage === 100
        ? "Course completed"
        : "Course in progress";

    // Return the calculated statistics
    res.status(200).json({
      status: "success",
      data: {
        //These stats give insights into how well the user performed in the completed lessons.
        // averageGrade,
        // averageLessonExamGrade,
        totalProgress,
        //These percentages show how many exams the user has completed and how many are still pending.
        examsCompletedPercentage,
        examsNotAttemptedPercentage,
        totalLessons,
        completedLessonsCount,
        notAttemptedLessonsCount,
        totalLessonsExamsPercentage,
        courseScore,
        lessonExamsAttemptedCount,
        lessonsScores,
        totalCourseExamsPercentage,
        completionStatus,
      },
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
