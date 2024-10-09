const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    highlights: [{ type: String }],
    subscriptionDurationDays: {
      type: Number,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      unique: true, //  package must belong to one course only
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
module.exports = mongoose.model("Package", packageSchema);
