const ApiError = require('../../utils/apiError');
const Exam = require('../../models/examModel');
const CourseProgress = require('../../models/courseProgressModel');

// Utility functions
/******************************************************************** */
// Calculate the score for the exam
exports.calculateScore = (questions, answers) => {
  let score = 0;
  const wrongAnswers = [];
  questions?.forEach((question) => {
    const answerObj = answers.find(
      (ans) => ans.questionId.toString() === question._id.toString(),
    );
    if (answerObj && answerObj.answer === question.correctOption) {
      score += question.grade;
    } else if (answerObj && answerObj.answer) {
      wrongAnswers.push({
        question: question._id,
        answer: answerObj.answer,
      });
    }
  });
  return { score, wrongAnswers };
};

exports.getTotalGrades = async (progress) => {
  // Fetch grades for completed lessons using Promise.all for parallel fetching
  const grades = await Promise.all(
    progress.map(async (lesson) => {
      const exam = await Exam.findOne({
        lesson: lesson.lesson._id,
        model: lesson.modelExam,
      });

      if (exam && exam.questions) {
        // Reduce over the 'questions' array to get the total score
        const totalGrade = exam.questions.reduce(
          (total, q) => total + (q.grade || 0),
          0,
        );
        return {
          lessonId: lesson.lesson._id,
          grade: totalGrade,
        };
      }
      return {
        lessonId: lesson.lesson._id,
        grade: 0, // Return 0 if no exam or no questions are found
      };
    }),
  );

  return grades; // Array of objects { lessonId, grade }
};

// Calculate the total possible score for the exam
exports.getTotalPossibleGrade = (questions) =>
  questions.reduce((total, question) => total + question.grade, 0);

// Check if the exam was passed based on the score percentage
exports.hasPassed = (score, totalScore, passingScore) =>
  (score / totalScore) * 100 >= passingScore;

// // Update the user's progress for a course or lesson
// exports.updateUserProgress = async ({
//   userId,
//   courseId,
//   exam,
//   passed,
//   score,
//   wrongAnswers,
//   isRequireAnalytic = false,
// }) => {
  
//   const passAnalytics = isRequireAnalytic ? false : null;
//   await CourseProgress.findOneAndUpdate(
//     { user: userId, course: courseId },
//     {
//       $push: {
//         progress: {
//           lesson: exam.lesson,
//           passAnalytics,
//           modelExam: exam.model,
//           status: passed ? 'Completed' : 'failed',
//           examScore: score,
//           attemptDate: new Date(),
//           wrongAnswers,
//         },
//       },
//     },
//     { new: true, upsert: false },
//   );
// };
// Handle success or failure response
exports.handleExamResponse = (res, passed, score, totalScore) =>
  res.status(200).json({
    status: 'success',
    data: {
      passed,
      score,
      totalScore,
    },
  });

/******************************************************************** */
// Utility function to fetch an exam based on lesson or course and model
/******************************************************************** */
exports.fetchExam = async ({ id, type, model }) => {
  if (type === 'placement') {
    return await Exam.findOne({ course: id, type, model });
  }
  return await Exam.findOne({ [type]: id, model });
};

// Utility function to exclude correct answers from the exam object
exports.excludeCorrectOptions = (exam) => {
  const modifiedExam = exam.toObject();
  modifiedExam.questions.forEach((question) => {
    delete question.correctOption;
  });
  return modifiedExam;
};

// Utility function to check user progress
exports.checkUserProgress = async (user, courseId, lessonOrder) => {
  const courseProgress = await CourseProgress.findOne({
    user: user._id,
    course: courseId,
  });

  // If no course progress is found, return an error
  if (!courseProgress) {
    throw new ApiError('You must start the course before taking the exam', 401);
  }

  const lastProgress = courseProgress.progress.length
    ? courseProgress.progress[courseProgress.progress.length - 1]
    : null;

  // If there's no progress yet, allow the user to start the first lesson
  if (!lastProgress && lessonOrder !== 1) {
    throw new ApiError('Cannot take this lesson out of order', 401);
  }

  // If there's progress but the last lesson was completed, prevent the user from retaking the lesson
  // if (
  //   lastProgress &&
  //   lastProgress.lesson._id.toString() === lessonId.toString() &&
  //   lastProgress.status === 'Completed'
  // ) {
  //   throw new ApiError('You have already completed this lesson', 401);
  // }

  // If the lesson order is not correct, block the user from proceeding
  if (lastProgress && lessonOrder > lastProgress.lesson.order + 1) {
    throw new ApiError('Cannot take this lesson out of order', 401);
  }
};
