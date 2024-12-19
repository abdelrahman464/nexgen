const mongoose = require("mongoose");

const couponSchema = mongoose.Schema(
  {
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    couponName: {
      type: String,
      required: true,
    },
    discount: Number,
    maxUsageTimes: {
      type: Number,
      required: true,
    },
    usedTimes: {
      type: Number,
      default: 0,
    },
    reason: String, // why this coupon was given
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "active", "rejected"],
    },
  },
  { timestamps: true }
);
// ^find => it mean if part of of teh word contains find
couponSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "marketer", select: "name email profileImg" });
  next();
});

//2- create model
module.exports = mongoose.model("Coupon", couponSchema);
