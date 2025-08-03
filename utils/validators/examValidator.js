const ApiError = require('../apiError');
const Course = require('../../models/courseModel');
const Exam = require('../../models/examModel');
const Lesson = require('../../models/lessonModel');

// Helper function to get course based on exam type
async function getCourseForExam(examData) {
  const { type, course: courseId, lesson: lessonId } = examData;

  // For course and placement exams, get course directly
  if (type === 'course' || type === 'placement') {
    return await Course.findById(courseId);
  }

  // For lesson exams, get course through lesson
  if (type === 'lesson') {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return null;
    return await Course.findById(lesson.course);
  }

  return null;
}

exports.isTheExamInstructor = async (req, res, next) => {
  try {
    // Admin users have full access
    if (req.user.role === 'admin') {
      return next();
    }

    const userId = req.user._id.toString();
    let examData;

    const examId = req.params.id || req.params.examId;

    // Get exam data from params (update/delete) or body (create)
    if (examId) {
      const exam = await Exam.findById(examId);
      if (!exam) {
        return next(new ApiError('Exam not found', 404));
      }
      examData = exam;
    } else {
      examData = req.body;
    }

    // Validate instructor permission based on exam type
    const course = await getCourseForExam(examData);

    if (!course) {
      return next(new ApiError('Associated course not found', 404));
    }

    if (course.instructor.toString() !== userId) {
      const resourceType = examData.type === 'lesson' ? 'lesson' : 'course';
      return next(
        new ApiError(`You are not the instructor of this ${resourceType}`, 403),
      );
    }

    next();
  } catch (error) {
    next(new ApiError('Failed to verify instructor permissions', 500));
  }
};
