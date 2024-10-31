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

//2- create model
module.exports = mongoose.model("Coupon", couponSchema);
