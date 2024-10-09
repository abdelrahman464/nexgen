const mongoose = require("mongoose");

const coursePackageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Package name is required"],
    },
    description: { type: String, required: true },
    highlights: [{ type: String }],
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    price: {
      type: Number,
      required: [true, "Package price is required"],
      trim: true,
      max: [200000, "Too long Package price"],
    },
    priceAfterDiscount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);
coursePackageSchema.pre(/^find/, function (next) {
  this.populate({ path: "courses", select: "title" })
  next();
});
module.exports = mongoose.model("CoursePackage", coursePackageSchema);
