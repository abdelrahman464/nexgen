const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/apiError');
const Exam = require('../models/examModel');
const CourseProgress = require('../models/courseProgressModel');
const Lesson = require('../models/lessonModel');
const Course = require('../models/courseModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const factory = require('./handllerFactory');
const { uploadMixOfFiles } = require('../middlewares/uploadImageMiddleware');

// Middleware to upload question image and options images-------------
exports.uploadQuestionAndOptions = uploadMixOfFiles([
  {
    name: 'questionImage',
    maxCount: 1,
  },
  {
    name: 'options',
    maxCount: 6,
  },
]);
// Image processing middleware
exports.processQuestionImages = asyncHandler(async (req, res, next) => {
  if (
    req.files.questionImage &&
    req.files.questionImage[0].mimetype.startsWith('image/')
  ) {
    const questionImageFileName = `questions-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.questionImage[0].buffer)
      .toFormat('webp')
      .webp({ quality: 95 })
      .toFile(`uploads/questions/${questionImageFileName}`);

    req.body.questionImage = questionImageFileName;
  } else if (req.files.questionImage) {
    return next(new ApiError('Question image is not an image file', 400));
  }

  if (req.files.options) {
    const imageProcessingPromises = req.files.options.map(
      async (img, index) => {
        if (!img.mimetype.startsWith('image/')) {
          return next(
            new ApiError(`Option ${index + 1} is not an image file.`, 400),
          );
        }

        const imageName = `option-${uuidv4()}-${Date.now()}-${index + 1}.webp`;

        await sharp(img.buffer)
          .toFormat('webp')
          .webp({ quality: 95 })
          .toFile(`uploads/questions/options/${imageName}`);

        return imageName;
      },
    );

    req.body.options = await Promise.all(imageProcessingPromises);
  }

  next();
});
//filters --------------------------------------------------------------
exports.createFilterObjCourseExam = async (req, res, next) => {
  const filterObject = { course: req.params.courseId, type: 'course' };
  req.filterObj = filterObject;
  next();
};
exports.createFilterObjLessonExam = async (req, res, next) => {
  const filterObject = { lesson: req.params.lessonId, type: 'lesson' };
  req.filterObj = filterObject;
  next();
};
exports.createFilterObjPlacementExam = async (req, res, next) => {
  const filterObject = { course: req.params.courseId, type: 'placement' };
  req.filterObj = filterObject;
  next();
};
exports.sendLoggedUserIdToParams = async (req, res, next) => {
  req.params.userId = req.user._id;
  next();
};
//Basic CRUD------------------------------------------------------------
exports.createExam = asyncHandler(async (req, res, next) => {
  const { lesson, course, model, passingScore, type } = req.body;

  let exam = {};
  // Create exam document
  if (type === 'lesson') {
    const existExam = await Exam.findOne({ lesson, model });
    if (existExam) {
      return next(
        new ApiError(
          `Exam already exists for this lesson with Model ${model}`,
          400,
        ),
      );
    }
    exam = await Exam.create({
      lesson,
      model,
      passingScore,
      type,
    });
  } else if (type === 'course' || type === 'placement') {
    const existExam = await Exam.findOne({ course, model, type });
    if (existExam) {
      return next(
        new ApiError(
          `Exam already exists for this course with Model ${model}`,
          400,
        ),
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
    status: 'success',
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
    { new: true, safe: true, upsert: true },
  );

  if (!updatedExam) {
    return next(new ApiError('Exam not found', 404));
  }

  res.status(200).json({
    status: 'success',
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
      arrayFilters: [{ 'elem._id': questionId }], // Specify the condition to identify the correct question to update
      new: true, // Return the updated document
    },
  );

  if (result.matchedCount === 0) {
    return next(new ApiError('Exam not found', 404));
  }

  if (result.modifiedCount === 0) {
    return next(new ApiError('Question not found or no update made', 404));
  }

  // Since updateOne doesn't return the updated document, we fetch it to return in response
  const updatedExam = await Exam.findById(examId);

  res.status(200).json({
    status: 'success',
    data: updatedExam,
  });
});

exports.removeQuestionsFromExam = asyncHandler(async (req, res, next) => {
  const { examId, questionId } = req.params;
  const exam = await Exam.findByIdAndUpdate(
    examId,
    { $pull: { questions: { _id: questionId } } },
    { new: true },
  );

  if (!exam) {
    return next(new ApiError('Exam not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Question removed successfully',
    data: exam.questions,
  });
});
//

function calculateScore(questions, answers) {
  let score = 0;
  const wrongAnswers = [];
  questions.forEach((question) => {
    const answerObj = answers.find(
      (ans) => ans.questionId.toString() === question._id.toString(),
    );
    if (answerObj && answerObj.answer === question.correctOption) {
      score += question.grade; // Add the question's grade to the score if the answer is correct
    } else if (answerObj && answerObj.answer) {
      wrongAnswers.push({
        question: question._id,
        answer: answerObj.answer,
      });
    }
  });
  return { score: score, wrongAnswers: wrongAnswers };
}

exports.lessonExam = async (req, res, next) => {
  const { id } = req.params; // 'id' is the lesson ID
  const { courseProgress, lesson } = req;

  // Error handling for missing data
  if (!lesson || !courseProgress) {
    return next(new ApiError('Missing required data.', 400));
  }

  // Check if the progress array is empty or if the lesson can be taken based on order and last status
  const lastProgress =
    courseProgress.progress[courseProgress.progress.length - 1];

  if (courseProgress.progress.length > 0) {
    if (
      lastProgress.lesson._id.toString() === lesson._id.toString() &&
      lastProgress.status === 'Completed'
    ) {
      // User has already completed this lesson successfully
      return next(new ApiError('You have already completed this lesson', 401));
    }

    if (
      !(
        lesson.order === lastProgress.lesson.order + 1 ||
        (lesson.order === lastProgress.lesson.order &&
          lastProgress.status === 'failed')
      )
    ) {
      // Lesson order is not sequential or not a retake after failure
      return next(
        new ApiError(
          'Cannot take this lesson exam out of order or without failing the previous attempt',
          401,
        ),
      );
    }
  }

  let examModel = 'A'; // Default exam model

  if (
    lastProgress &&
    lesson.order === lastProgress.lesson.order &&
    lastProgress.status === 'failed'
  ) {
    // Check if Model B exists
    const modelBExists = await Exam.exists({ lesson: id, model: 'B' });

    if (!modelBExists) {
      // Assign Model A if Model B exists
      examModel = 'A';
    } else {
      // Switch exam model for retake
      examModel = lastProgress.modelExam === 'A' ? 'B' : 'A';
    }
  }
  // Fetch the appropriate exam based on the logic above
  const exam = await Exam.findOne({ lesson: id, model: examModel });

  // Error handling for no exam found
  if (!exam) {
    return next(new ApiError('No exam found for this lesson', 404));
  }

  // Exclude the correctOption from each question
  const modifiedExam = exam.toObject(); // Convert the Mongoose document to a plain JavaScript object
  modifiedExam.questions.forEach((question) => {
    delete question.correctOption; // Remove the correctOption from each question
  });

  return res.status(200).json({ status: 'success', exam: modifiedExam });
};
//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------
exports.CourseExam = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // Course ID

  // Fetch all lesson IDs for the course
  const lessonIds = await Lesson.find({ course: id }).select('_id');

  // Fetch the user's course progress
  const examResult = await CourseProgress.findOne({
    user: req.user._id,
    course: id,
  });

  if (!examResult) {
    return next(
      new ApiError('You must start the course before taking the exam', 401),
    );
  }

  if (examResult.status === 'Completed') {
    return next(new ApiError('You have already completed this course', 401));
  }

  // Check if each lesson has a corresponding "Completed" entry in the progress array
  const hasCompletedAllLessons = lessonIds.every((lesson) =>
    examResult.progress.some(
      (p) =>
        p.lesson._id.toString() === lesson._id.toString() &&
        p.status === 'Completed',
    ),
  );

  if (!hasCompletedAllLessons) {
    return next(
      new ApiError(
        'You must complete all lesson exams before taking the course exam',
        401,
      ),
    );
  }

  // Proceed to find the exam (handle retakes or initial takes as before)
  let exam;
  if (examResult.status === 'failed') {
    // Determine model for retake (if model B is available)
    if (examResult.modelExam === 'B') {
      exam = await Exam.findOne({ course: id, model: 'B' });
    }
    // If model B is not available or not specified, fallback to model A
    if (!exam) {
      exam = await Exam.findOne({ course: id, model: 'A' });
    }
  } else {
    exam = await Exam.findOne({ course: id, model: 'A' });
  }

  if (!exam) {
    return next(new ApiError('No exam found for this course', 404));
  }

  // Exclude the correctOption from each question
  const modifiedExam = exam.toObject(); // Convert the Mongoose document to a plain JavaScript object
  modifiedExam.questions.forEach((question) => {
    delete question.correctOption; // Remove the correctOption from each question
  });
  return res.status(200).json({ status: 'success', exam: modifiedExam });
});

exports.placmentExam = async (req, res, next) => {
  const courseId = req.params.id;
  const { user } = req;
  //check if theres is exam for this course
  const examExist = await Exam.findOne({
    course: courseId,
    type: 'placement',
  });
  if (!examExist) {
    return next(
      new ApiError('There is no placement exam for this course', 404),
    );
  }

  // Check user's exam status and determine the appropriate exam model
  let modelExam;
  if (user.placmentExam && user.placmentExam.status === 'Completed') {
    return next(new ApiError('You have already taken placement exam', 401));
  }
  if (
    user.placmentExam &&
    user.placmentExam.status === 'failed' &&
    user.placmentExam.course.toString() === courseId
  ) {
    const theLastExam = await Exam.findOne({
      course: user.placmentExam.course,
      type: 'placement',
    });
    modelExam = theLastExam.model === 'A' ? 'B' : 'A';
  } else {
    modelExam = 'A'; // Default model
  }

  // Get the exam based on the determined model
  const finalExam = await Exam.findOne({
    course: courseId,
    model: modelExam,
    type: 'placement',
  });

  if (!finalExam) {
    return next(new ApiError('No exam found for this course', 404));
  }
  // Exclude the correctOption from each question
  const modifiedExam = finalExam.toObject(); // Convert the Mongoose document to a plain JavaScript object
  modifiedExam.questions.forEach((question) => {
    delete question.correctOption; // Remove the correctOption from each question
  });
  return res.status(200).json({ status: 'success', exam: modifiedExam });
};

exports.submitCoursePlacmentAnswers = async (req, res, next) => {
  const { id } = req.params;
  const { answers } = req.body;
  const { user } = req;
  const exam = await Exam.findById(id);
  if (!exam) {
    return next(new ApiError('Exam not found', 404));
  }

  if (
    user.placmentExam.status === 'failed' &&
    exam.model === user.placmentExam.modelExam
  ) {
    return next(new ApiError('You have already failed this exam.', 400));
  }

  // Calculate the score
  const examResult = calculateScore(exam.questions, answers);

  const totalPossibleScore = exam.questions.reduce(
    (total, question) => total + question.grade,
    0,
  );

  // Convert the obtained score to a percentage
  const scorePercentage = (examResult.score / totalPossibleScore) * 100;

  // Check if the user has passed the exam
  const passed = scorePercentage >= exam.passingScore;
  const userEsss = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: {
        placmentExam: {
          exam: exam._id,
          score: examResult.score,
          status: passed ? 'Completed' : 'failed',
          course: exam.course,
          attemptDate: Date.now(),
          wrongAnswers: examResult.wrongAnswers,
        },
      },
    },
    { new: true },
  );
  //return response
  if (!passed) {
    return res.status(200).json({
      status: 'failed',
      score: examResult.score,
      passed: passed,
      message: 'unfortunately you failed in placment exam',
    });
  }

  return res.status(200).json({
    status: `${passed ? 'Congrats' : 'unfortunately'} you got ${
      examResult.score
    } out of ${totalPossibleScore},
      ${
        passed ? 'You have passed the exam.' : 'You have not passed the exam.'
      }`,
  });
};
//--------------------------------------------------------------------------
exports.submitLessonAnswers = async (req, res, next) => {
  const { id } = req.params; // Exam ID
  const { answers } = req.body; // User's answers

  // Fetch the exam by its ID
  const exam = await Exam.findOne({ _id: id, type: 'lesson' });
  if (!exam) {
    return next(new ApiError('Exam not found', 404));
  }

  const lesson = await Lesson.findById(exam.lesson);
  if (!lesson) {
    return next(new ApiError('Lesson not found', 404));
  }
  //#######################################################################
  // Check if the user has already successfully completed the exam for this lesson
  //get user progress on the lesson course
  const existingProgress = await CourseProgress.findOne({
    user: req.user._id,
    course: lesson.course,
  });

  // extract the object of that lesson
  if (existingProgress) {
    const lessonProgresses = existingProgress.progress.filter(
      (p) => p.lesson._id.toString() === exam.lesson.toString(),
    );
    if (lessonProgresses.length > 0) {
      const lastProgress = lessonProgresses[lessonProgresses.length - 1];
      if (lastProgress.status === 'Completed') {
        return next(new ApiError('You have already passed this exam.', 400));
      }
      //####################################################################### UNDER TESTING $#$##$#$
      // if (
      //   lastProgress.status === "failed" &&
      //   exam.model === lastProgress.modelExam
      // ) {
      //   return next(new Error("You have already failed this exam."));
      // }
    }
  }
  //#######################################################################
  // Calculate the score
  const examResult = calculateScore(exam.questions, answers);
  // Calculate the total possible score
  const totalPossibleScore = exam.questions.reduce(
    (total, question) => total + question.grade,
    0,
  );

  // Convert the obtained score to a percentage
  const scorePercentage = (examResult.score / totalPossibleScore) * 100;

  // Check if the user has passed the exam
  const passed = scorePercentage >= exam.passingScore;
  console.log(examResult.wrongAnswers);
  // Update the course progress
  await CourseProgress.findOneAndUpdate(
    {
      user: req.user._id,
      course: lesson.course,
    },
    {
      $push: {
        progress: {
          lesson: exam.lesson,
          modelExam: exam.model,
          status: passed ? 'Completed' : 'failed',
          examScore: scorePercentage,
          attemptDate: new Date(),
          wrongAnswers: examResult.wrongAnswers,
        },
      },
    },
    { new: true, upsert: false },
  );

  return res.status(200).json({
    status: `${passed ? 'Congrats' : 'unfortunately'} you got ${
      examResult.score
    } out of ${totalPossibleScore}, ${
      passed ? 'You have passed the exam.' : 'You have not passed the exam.'
    }`,
  });
};

//--------------------------------------------------------------------------

exports.submitCourseAnswers = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params; // exam ID
    const { answers } = req.body;
    const adminId = mongoose.Types.ObjectId('66447ad7a7957a07c0ae9e69');

    const exam = await Exam.findById(id);
    if (!exam) {
      return next(new ApiError('Exam not found', 404));
    }

    const course = await Course.findById(exam.course);
    if (!course) {
      return next(new ApiError('Course not found', 404));
    }

    // Check if the user has already successfully completed the exam
    let existingProgress = await CourseProgress.findOne({
      user: req.user._id,
      course: exam.course,
    });

    if (existingProgress && existingProgress.status === 'Completed') {
      return next(new ApiError('You have already passed this exam.', 400));
    }

    // Calculate the score
    const examResult = calculateScore(exam.questions, answers);
    const totalPossibleScore = exam.questions.reduce(
      (total, question) => total + question.grade,
      0,
    );

    // Convert the obtained score to a percentage
    const scorePercentage = (examResult.score / totalPossibleScore) * 100;

    // Determine if the user passed
    const passed = scorePercentage >= exam.passingScore;

    const updateData = {
      modelExam: exam.model,
      status: passed ? 'Completed' : 'failed',
      score: scorePercentage.toFixed(2),
      attemptDate: Date.now(),
      wrongAnswers: examResult.wrongAnswers,
    };

    // If course progress exists, update it; if not, create a new record
    if (existingProgress) {
      existingProgress = await CourseProgress.findOneAndUpdate(
        { user: req.user._id, course: exam.course },
        { $set: updateData },
        { new: true, upsert: true },
      );
    } else {
      updateData.user = req.user._id;
      updateData.course = exam.course;
      existingProgress = await CourseProgress.create(updateData);
    }

    // Calculate the user's overall course performance
    const totalExamScore = existingProgress.progress.reduce(
      (total, progress) => total + progress.examScore,
      0,
    );
    const numberOfLessons = existingProgress.progress.length;
    const totalPossibleCourseScore = numberOfLessons * 100; // Assuming each lesson's exam score is out of 100
    const courseAvgScore =
      (totalExamScore / totalPossibleCourseScore) * 100 || 0;

    // Check if the user deserves a certificate
    if (courseAvgScore >= 90 && passed === true) {
      await CourseProgress.findOneAndUpdate(
        { user: req.user._id, course: exam.course },
        { $set: { 'certificate.isdeserve': true } },
      );

      // Send a notification to the user
      await Notification.create({
        user: req.user._id,
        message: `You have earned a certificate for the course ${course.title}. Please wait for the admin to issue it.`,
      });

      // Send a notification to the admin
      await Notification.create({
        user: adminId,
        message: `User ${req.user.email} has earned a certificate for the course ${course.title}.`,
      });
    }

    // Respond to the user
    return res.status(200).json({
      status: passed ? 'Congrats' : 'unfortunately',
      message: `${
        passed ? 'You have passed the exam.' : 'You have not passed the exam.'
      } You scored ${examResult.score} out of ${totalPossibleScore}.`,
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

//--------------------------------------------------------------------------
// Assuming `canRetakeExam` middleware is meant to allow retake, you should use `retakeExam` method correctly.
// But since `retakeExam` is not directly related to allowing retake but performing it, the middleware name might be misleading.
// Ensure this middleware's logic aligns with its purpose or rename it accordingly.
// exports.canRetakeExam = asyncHandler(async (req, res, next) => {
//   try {
//     const { userId, examId } = req.params; // Assuming userId is correctly obtained
//     await this.retakeExam(userId, examId); // Correctly call retakeExam without directly using examService
//     next();
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// exports.userScores = asyncHandler(async (req, res, next) => {
//   const { courseId } = req.params;
//   const { userId } = req.body;
//   const course = await CourseProgress.findOne({
//     course: courseId,
//   });
//   if (!course) {
//     throw new ApiError("Course not found", 404);
//   }
//   const user = await User.findOne({
//     _id: userId,
//   });
//   if (!user) {
//     throw new ApiError("User not found", 404);
//   }

//   const userScores = await CourseProgress.findOne({
//     user: userId,
//     course: courseId,
//   });
//   res.status(200).json({ status: "success", data: userScores });
// });
//userScores
exports.userScores = asyncHandler(async (req, res, next) => {
  const { courseId, userId } = req.params;

  if (!userId) {
    return next(new ApiError('User not found', 404));
  }

  // Fetch the user's course progress
  const courseProgress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  }).populate('progress.lesson', 'title order');

  // Fetch all lessons associated with the course
  const allLessons = await Lesson.find({ course: courseId }, '_id').populate(
    'course',
    'title',
  );

  if (!courseProgress) {
    return next(new Error('No course progress found for this user.'));
  }

  const attemptedLessonIds = new Set();
  let totalExamScore = 0;
  let completedLessonsCount = 0;

  // Process completed exams
  courseProgress.progress.forEach((item) => {
    if (item.status === 'Completed') {
      completedLessonsCount += 1;
      totalExamScore += item.examScore;
      attemptedLessonIds.add(item.lesson._id.toString());
    }
  });

  const notAttemptedLessonsCount = allLessons.filter(
    (lesson) => !attemptedLessonIds.has(lesson._id.toString()),
  ).length;

  //////////////
  const numberOfLessons = courseProgress.progress.length;
  const totalPossibleCourseScore = numberOfLessons * 100; // Assuming each lesson's exam score is out of 100
  const averageGradePercentage =
    (totalExamScore / totalPossibleCourseScore) * 100 || 0;

  //////////////

  const totalLessons = allLessons.length;
  const examsCompletedPercentage = (
    (completedLessonsCount / totalLessons) *
    100
  ).toFixed(2);
  const examsNotAttemptedPercentage = (
    (notAttemptedLessonsCount / totalLessons) *
    100
  ).toFixed(2);

  const completedLessonsPercentage = (
    (completedLessonsCount / totalLessons) *
    100
  ).toFixed(2);
  // Assuming finalExamScore is available, adjust according to your actual data structure
  const finalExamScore = courseProgress.score || 0;
  const finalExamCompletionPercentage = finalExamScore > 0 ? 100 : 0; // Simplified for illustration

  // Calculate total progress with weights
  const lessonExamsWeight = 0.8;
  const finalExamWeight = 0.2;
  const totalProgress = (
    examsCompletedPercentage * lessonExamsWeight +
    finalExamCompletionPercentage * finalExamWeight
  ).toFixed(2);

  res.status(200).json({
    status: 'success',
    data: {
      averageGradePercentage,
      totalProgress,
      finalExamCompletionPercentage,
      examsCompletedPercentage,
      examsNotAttemptedPercentage,
      totalLessons,
      completedLessonsCount,
      completedLessonsPercentage,
    },
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
    return next(new ApiError('Course progress not found', 404));
  }

  res.status(200).json({ status: 'success', data: courseProgress });
});
//--------------------------------------------------
//@route   GET /getLessonPerformance/:userId/:lessonId
//@desc    Get lesson Questions and user performance
//@access  Private(owner || admin)
exports.getLessonPerformance = asyncHandler(async (req, res, next) => {
  const { userId, lessonId } = req.params;

  const courseProgress = await CourseProgress.findOne({
    user: userId,
    'progress.lesson': lessonId,
  });

  if (!courseProgress) {
    return next(new ApiError('Course progress not found', 404));
  }
  const { progress } = courseProgress;
  // res.json({ status: "success", data: courseProgress });
  const lessonExamResult = progress.find(
    (p) => p.lesson._id.toString() === lessonId,
  ); //return Lesson_exam_object
  // console.log(lessonExamResult);
  if (!lessonExamResult) {
    return next(new ApiError('Lesson progress not found', 404));
  }
  // console.log(lessonExamResult);
  const lessonQuestions = await this.checkLessonQuestionsStatus(
    lessonExamResult,
  );

  return res.status(200).json({ status: 'success', lessonQuestions });
});
//--------------------------------------------------
//@route   ----
//@desc    check Lesson Questions Status whether it is correct or not , if not add property wrongAnswer that inform client if it is wrong
//@access  internal function
exports.checkLessonQuestionsStatus = async (lessonExamResult) => {
  // Get all questions of this lesson
  const lessonExam = await Exam.findOne({
    lesson: lessonExamResult.lesson._id,
  }).select('questions');
  // Convert each question to a plain JavaScript object
  //This allows you to freely add new properties
  const lessonExamQuestions = lessonExam.questions.map((question) =>
    question.toObject(),
  );

  // Iterate over questions and find wrong answered question
  lessonExamQuestions.forEach((question) => {
    const wrongAnsweredQuestion = lessonExamResult.wrongAnswers.find(
      (ans) => ans.question.toString() === question._id.toString(),
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
  // console.log(lessonExamResult);
  const lessonQuestions = await this.checkCourseQuestionsStatus(
    courseExamResult,
  );

  return res.status(200).json({ status: 'success', lessonQuestions });
});
//@route   ----
//@desc    check Course Questions Status whether it is correct or not , if not add property wrongAnswer that inform client if it is wrong
//@access  internal function
exports.checkCourseQuestionsStatus = async (courseExamResult) => {
  // Get all questions of this lesson
  const courseExam = await Exam.findOne({
    course: courseExamResult.course,
  }).select('questions');
  // Convert each question to a plain JavaScript object
  //This allows you to freely add new properties
  const courseExamQuestions = courseExam.questions.map((question) =>
    question.toObject(),
  );

  // Iterate over questions and find wrong answered question
  courseExamQuestions.forEach((question) => {
    const wrongAnsweredQuestion = courseExamResult.wrongAnswers.find(
      (ans) => ans.question.toString() === question._id.toString(),
    );
    if (wrongAnsweredQuestion) {
      question.wrongAnswer = wrongAnsweredQuestion.answer;
    }
  });
  return courseExamQuestions;
  // Continue with the rest of the code...
};
