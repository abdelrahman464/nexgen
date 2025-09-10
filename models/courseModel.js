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
    //i18n
    title: {
      type: String,
      i18n: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    //use this field to know how many starts in certificate image
    rating: {
      type: Number,
      default: 0,
    },
    certificateDescription: {
      type: String,
      i18n: true,
    },
    description: {
      type: String,
      i18n: true,
    },
    type: String,
    highlights: [
      {
        type: Object,
        i18n: true,
      },
    ],
    //
    image: {
      type: String,
    },
    colors: {
      bgColor: String,
      bgDarkMode: String,
      fontColor: String,
      fontDarkMode: String,
    },

    price: {
      type: Number,
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
    coursePercentage: Number,
    courseDuration: {
      type: Number,
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
    courseWelcomeMessage: String,
    goodByeMessage: String,
    hasQuiz: Boolean,

    status: {
      type: String,
      enum: ["active", "inActive"],
      default: "inActive",
    },
  },
  {
    timestamps: true,
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
  this.populate({ path: "instructor", select: "name email profileImg" });
  next();
});
const setCourseImageURL = (doc) => {
  //return image base url + image name
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

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
