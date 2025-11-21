const mongoose = require("mongoose");

const AnalyticSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    content: {
      type: String,
      required: true,
    },
    //marketer will determine that
    isPassed: {
      type: Boolean,
      default: false,
    },
    isSeen: {
      type: Boolean,
      default: false,
    },
    marketerComment: {
      type: String,
    },
    //----------
    imageCover: {
      type: String,
    },
    media: {
      type: [String],
    },
  },
  { timestamps: true }
);

// ^find => it mean if part of of teh word contains find
AnalyticSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "user", select: "name profileImg" });
  next();
});
const setImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.imageCover) {
    doc.imageCover = `${process.env.BASE_URL}/analytics/${doc.imageCover}`;
  }
  if (doc.media) {
    const mediaListWithUrl = [];
    doc.media.forEach((m) => {
      const mediaUrl = `${process.env.BASE_URL}/analytics/${m}`;
      mediaListWithUrl.push(mediaUrl);
    });
    doc.media = mediaListWithUrl;
  }
};

//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
AnalyticSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
AnalyticSchema.post("save", (doc) => {
  setImageURL(doc);
});
const Analytic = mongoose.model("Analytics", AnalyticSchema);
module.exports = Analytic;
