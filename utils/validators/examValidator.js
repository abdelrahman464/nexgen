const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
const Exam = require("../../models/examModel");
const Lesson = require("../../models/lessonModel");

exports.checkInstructorAccess = async (req, res, next) => {
  let { examId, id } = req.params;

  examId = examId || id;
  //if admin let him pass
  if (req.user.role === "admin") {
    return next();
  }
  //if user make sure that he is the instructor of the course

  const exam = await Exam.findById(examId);
  if (!exam) {
    return next(new ApiError(res.__("errors.Not-Found"), 403));
  }
  //get course,lesson from exam depend on exam type
  // if exam type is lesson ,then get course from lesson
  let course;
  let lesson;
  if (exam.type === "lesson") {
    lesson = await Lesson.findById(exam.lesson);
    course = await Course.findById(lesson.course);
  } else if (exam.type === "course" || exam.type === "placement") {
    course = await Course.findById(exam.course);
  }
  //check if user is instructor of course or lesson
  if (!course || course.instructor.toString() !== req.user._id.toString()) {
    return next(
      new ApiError("You are not authorized to access this exam", 403)
    );
  }

  res.status(200).json({ data: exam });

  next();
};
