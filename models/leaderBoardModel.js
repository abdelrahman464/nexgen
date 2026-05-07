const mongoose = require("mongoose");

const leaderBoardSchema = new mongoose.Schema(
  {
    year: Number,
    month: Number,
    firstRank: {
      amount: Number,
      marketer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      gotInAt: {
        type: Date,
      },
    },
    secondRank: {
      amount: Number,
      marketer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      gotInAt: {
        type: Date,
      },
    },
    thirdRank: {
      amount: Number,
      marketer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      gotInAt: {
        type: Date,
      },
    },
  },
  { timestamps: true, strict: false }
);
leaderBoardSchema.pre(/^find/, function (next) {
  this.populate({
    path: "firstRank.marketer",
    select: "name email profileImg",
  })
    .populate({
      path: "secondRank.marketer",
      select: "name email profileImg",
    })
    .populate({
      path: "thirdRank.marketer",
      select: "name email profileImg",
    });
  next();
});

const LeaderBoard = mongoose.models.LeaderBoard || mongoose.model("LeaderBoard", leaderBoardSchema);

module.exports = LeaderBoard;
