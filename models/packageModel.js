const mongoose = require("mongoose");

//**
// @desc : each package avail users to attend (lives) only , not any thing else
// @desc : each package is related to one course only
// @desc : we handle package subscription in userSubscriptionModel.js
// **/
const packageSchema = new mongoose.Schema(
  {
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      unique: true, //  package must belong to one course only
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    title: { type: String, required: true, i18n: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: { type: String, required: true, i18n: true },
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
    subscriptionDurationDays: {
      type: Number,
      required: true,
    },
    image: String,
    status: {
      type: String,
      enum: ["active", "pending"],
      default: "pending",
    },
    price: {
      type: Number,
      required: [true, "Package price is required"],
      trim: true,
      max: [200000, "Too long Course price"],
    },
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
    type: {
      type: String,
      enum: ["service", "course"],
      default: "service",
    },
  },
  { timestamps: true }
);
// ^find => it mean if part of of teh word contains find
packageSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({
    path: "course",
    select: "title colors -accessibleCourses -category",
  });

  next();
});
const setImageURL = (doc) => {
  //return image base url + image name
  if (doc.image) {
    const imageURL = `${process.env.BASE_URL}/packages/${doc.image}`;
    doc.image = imageURL;
  }
};
//after intialize the doc in db
// check if the document contains image
// it work with findOne,findAll,update
packageSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
packageSchema.post("save", (doc) => {
  setImageURL(doc);
});
module.exports = mongoose.model("Package", packageSchema);
