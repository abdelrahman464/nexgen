const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    type: {
      type: String,
      enum: ["course", "lesson", "placement"],
      required: true,
    },
    model: {
      type: String,
      enum: ["A", "B"],
      default: "A",
    },
    passingScore: { type: Number, required: true, default: 70 }, // Assume the score is a percentage
    questions: [
      {
        question: String,
        questionImage: String,
        options: [String], // Assuming multiple choice for simplicity // the options my be an image
        correctOption: Number,
        grade: Number, // You might want to assign different scores to different questions
      },
    ],
    
  },
  { timestamps: true }
);
const setQuestionImageURLs = (doc) => {
  const baseUrl = process.env.BASE_URL; // Fallback base URL

  if (doc.questions && doc.questions.length > 0) {
    doc.questions.forEach((question) => {
      // Transform the questionImage URL
      if (
        question.questionImage &&
        !question.questionImage.startsWith("http")
      ) {
        question.questionImage = `${baseUrl}/questions/${question.questionImage}`;
      }

      // Ensure options are transformed correctly
      if (question.options && question.options.length > 0) {
        question.options = question.options.map((option) => {
          if (
            typeof option === "string" &&
            !option.startsWith("http") &&
            (option.endsWith(".jpg") ||
              option.endsWith(".jpeg") ||
              option.endsWith(".png") ||
              option.endsWith(".webp"))
          ) {
            return `${baseUrl}/questions/options/${option}`;
          }
          return option;
        });
      }
    });
  }
};

examSchema.post("init", (doc) => {
  setQuestionImageURLs(doc);
});

// After saving a document (creating or updating)
examSchema.post("save", (doc) => {
  setQuestionImageURLs(doc);
});
module.exports = mongoose.model("Exam", examSchema);
