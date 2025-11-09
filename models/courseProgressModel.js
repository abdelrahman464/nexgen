const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    modelExam: { type: String }, // will be set after taking exam and will be used to retake the other model
    score: { type: Number }, //will be set after finishing the course
    status: {
      type: String,
      enum: ['notTaken', 'failed', 'Completed'],
      default: 'notTaken',
    },
    wrongAnswers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId },
        answer: { type: String },
      },
    ],

    progress: [
      {
        lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
        modelExam: { type: String },
        status: {
          type: String,
          enum: ['failed', 'Completed'],
          default: 'Completed',
        },
        passAnalytics: Boolean, // to detect if student has uploaded analytic doc to be corrected
        examScore: { type: Number, default: 0 },
        attemptDate: { type: Date, default: Date.now },
        wrongAnswers: [
          {
            question: { type: mongoose.Schema.Types.ObjectId },
            answer: String,
          },
        ],
      },
    ],
    certificate: {
      _id: mongoose.Schema.Types.ObjectId,
      file: { type: String },
    },
    attemptDate: { type: Date },
  },
  { timestamps: true },
);
courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });
courseProgressSchema.index({ user: 1 });
courseProgressSchema.index({ course: 1 });
courseProgressSchema.index({ 'progress.lesson': 1 });

const setCertificateFileURL = (doc) => {
  //return image base url + image name
  if (doc.certificate.file) {
    const certificateFileUrl = `${process.env.BASE_URL}/certificate/${doc.certificate.file}`;
    doc.certificate.file = certificateFileUrl;
  }
};
//after initialize the doc in db
// check if the document contains image
// it work with findOne,findAll,update
courseProgressSchema.post('init', (doc) => {
  setCertificateFileURL(doc);
});
// it work with create
courseProgressSchema.post('save', (doc) => {
  setCertificateFileURL(doc);
});

// ^find => it mean if part of of teh word contains find
courseProgressSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: 'progress.lesson', select: 'title order' });
  next();
});

module.exports = mongoose.model('CourseProgress', courseProgressSchema);
