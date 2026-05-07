const mongoose = require("mongoose");

const systemReviewSchema = mongoose.Schema(
  {
    title: {
      type: "String",
    },
    ratings: {
      type: Number,
      min: [1, "min value is 1.0"],
      max: [5, "max value is 5.0"],
      required: [true, "review ratings required"],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "review must belong to user"],
    },
    replay: String,
  },
  { timestamps: true }
);

// any query containe find
systemReviewSchema.pre(/^find/, function (next) {
  this.populate({ path: "user", select: "name profileImg" });
  next();
});

//2- create model
module.exports =
  mongoose.models.SystemReview || mongoose.model("SystemReview", systemReviewSchema);
