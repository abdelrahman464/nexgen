const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");

exports.modifyExamQuestionsNumber = async (updatedExam) => {
  try {
    if (updatedExam.course) {
      await Course.findOneAndUpdate(
        { _id: updatedExam.course },
        { $set: { finalExamQuestionsNumber: updatedExam.questions.length } }
      );
    } else if (updatedExam.lesson) {
      await Lesson.findOneAndUpdate(
        { _id: updatedExam.lesson },
        { $set: { examQuestionsNumber: updatedExam.questions.length } }
      );
    }

    return true;
  } catch (error) {
    console.error("Error modifying exam questions number:", error);
    return false;
  }
};
