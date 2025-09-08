const mongoose = require("mongoose");

const LiveSchema = new mongoose.Schema(
  {
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
      i18n: true,
    },
    date: {
      type: Date,
      required: [true, "what is the date of the live will be ?"],
    },
    package: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Package",
      },
    ],
    link: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// ^find => it mean if part of of teh word contains find
LiveSchema.pre(/^find/, function (next) {
  this.populate({ path: "package", select: "title course" }).populate({
    path: "instructor",
    select: "name email profileImg",
  });
  next();
});

module.exports = mongoose.model("Live", LiveSchema);
