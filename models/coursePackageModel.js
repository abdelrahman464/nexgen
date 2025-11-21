const mongoose = require("mongoose");

const coursePackageSchema = new mongoose.Schema(
  {
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    profitableCourses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
        },
        instructorPercentage: Number,
        instructorProfits: Number,
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    title: {
      type: String,
      i18n: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["active", "pending" , "inActive"],
      default: "pending",
    },
    description: { type: String, i18n: true },
    highlights: [{ type: Object, i18n: true }],
    whatWillLearn: [
      {
        type: Object,
        i18n: true,
      },
    ],
    coursePrerequisites: [
      {
        type: Object,
        i18n: true,
      },
    ],
    whoThisCourseFor: [
      {
        type: Object,
        i18n: true,
      },
    ],
    image: String,
    price: {
      type: Number,
      trim: true,
      max: [200000, "Too long Package price"],
    },
    type: String,
    priceAfterDiscount: {
      type: Number,
    },
    // SEO fields
    metaTitle: {
      type: String,
      i18n: true,
    },
    metaDescription: {
      type: String,
      i18n: true,
    },
    keywords: {
      type: String,
      i18n: true,
    },
  },
  {
    timestamps: true,
  }
);
coursePackageSchema.pre(/^find/, function (next) {
  this.populate({ path: "courses", select: "title courseDuration" });
  next();
});

const setCourseImageURL = (doc) => {
  //return image base url + image name
  if (doc.image) {
    const CourseImageURL = `${process.env.BASE_URL}/coursePackages/${doc.image}`;
    doc.image = CourseImageURL;
  }
};
//after intialize the doc in db
// check if the document contains image
// it work with findOne,findAll,update
coursePackageSchema.post("init", (doc) => {
  setCourseImageURL(doc);
});
// it work with create
coursePackageSchema.post("save", (doc) => {
  setCourseImageURL(doc);
});
module.exports = mongoose.model("CoursePackage", coursePackageSchema);
