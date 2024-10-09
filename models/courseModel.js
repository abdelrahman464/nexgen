const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    finalExam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    placmentExam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    image: {
      type: String,
      required: true,
    },
    colors: {
      bgColor: String,
      bgDarkMode: String,
      fontColor: String,
      fontDarkMode: String,
    },
    highlights: [{ type: String }],
    price: {
      type: Number,
      required: [true, "Course price is required"],
      trim: true,
      max: [200000, "Too long Course price"],
    },
    priceAfterDiscount: {
      type: Number,
    },
    ratingsAverage: {
      type: Number,
      min: [1, "rating must be between 1.0 and 5.0"],
      max: [5, "rating must be between 1.0 and 5.0"],
      set: (v) => parseFloat(v.toFixed(1)), // Rounds to 2 decimal places
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    needAccessibleCourse: {
      type: Boolean,
      default: true,
    },
    accessibleCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    instructorPercentage: {
      type: Number,
    },
  },
  {
    timestamps: true,
    timeseries: true,
    // to enable vitual population
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// virtual field =>reviews
courseSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "course",
  localField: "_id",
});

courseSchema.pre(/^find/, function (next) {
  this.populate({ path: "category", select: "title" }).populate({
    path: "accessibleCourses",
  });
  next();
});
const setCourseImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.image) {
    const CourseImageURL = `${process.env.BASE_URL}/courses/${doc.image}`;
    doc.image = CourseImageURL;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
courseSchema.post("init", (doc) => {
  setCourseImageURL(doc);
});
// it work with create
courseSchema.post("save", (doc) => {
  setCourseImageURL(doc);
});
courseSchema.pre("save", function (next) {
  setCourseImageURL(this);
  next();
});

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
