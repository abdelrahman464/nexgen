const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    title: {
      type: String,
      required: true,
      i18n: true,
    },
    description: {
      type: String,
      i18n: true,
    },
    type: {
      type: String,
      enum: ["live", "recorded"],
      default: "recorded",
    },
    image: {
      type: String,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    attachments: [String],
    order: { type: Number },
    lessonDuration: {
      type: Number,
      required: true,
    },

    assignmentTitle: {
      type: String,
      i18n: true,
    },
    assignmentDescription: {
      type: String,
      i18n: true,
    },
    hasQuiz: { type: Boolean, default: false },
    assignmentFile: String,

    isRequireAnalytic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

lessonSchema.pre(/^find/, function (next) {
  this.populate({ path: "course", select: "_id title -category" });
  next();
});

const setImageURL = (doc) => {
  //return image base url + image name
  if (doc.image) {
    const imageUrl = `${process.env.BASE_URL}/lessons/images/${doc.image}`;
    doc.image = imageUrl;
  }
  if (doc.assignmentFile) {
    const assignmentFileUrl = `${process.env.BASE_URL}/lessons/assignments/${doc.assignmentFile}`;
    doc.assignmentFile = assignmentFileUrl;
  }
  //return attachment base url + attachment name
  if (doc.attachments && Array.isArray(doc.attachments)) {
    doc.attachments = doc.attachments.map(
      (file) => `${process.env.BASE_URL}/lessons/attachments/${file}`
    );
  }
};
//after initialize the doc in db
// check if the document contains image
// it work with findOne,findAll,update
lessonSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
lessonSchema.post("save", (doc) => {
  setImageURL(doc);
});

// Adjust the pre('save') middleware to be defined before compiling the model
// lessonSchema.pre("save", async function (next) {
//   if (!this.isModified("order")) {
//     const courseId = this.course;
//     const lastLesson = await this.constructor
//       .findOne({ course: courseId })
//       .sort("-order");

//     this.order = lastLesson && lastLesson.order ? lastLesson.order + 1 : 1;
//   }
//   next();
// });

const Lesson = mongoose.model("Lesson", lessonSchema);
module.exports = Lesson;
