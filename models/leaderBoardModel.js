const mongoose = require("mongoose");

const leaderBoardSchema = new mongoose.Schema({
  year: Number,
  month: Number,
  firstRank: {
    amount: Number,
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
  secondRank: {
    amount: Number,
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
  thirdRank: {
    amount: Number,
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
});

const LeaderBoard = mongoose.model("LeaderBoard", leaderBoardSchema);

module.exports = LeaderBoard;
