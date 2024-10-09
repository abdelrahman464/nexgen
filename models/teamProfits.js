const mongoose = require("mongoose");

const teamProfitSchema = new mongoose.Schema(
  {
    totalProfit: {
      type: Number,
      default: 0,
    },
    desc: {
      type: String,
    },
    marketing: {
      type: Number,
      default: 0,
    },
    dawood: {
      type: Number,
      default: 0,
    },
    artosh: {
      type: Number,
      default: 0,
    },
    gomaa: {
      type: Number,
      default: 0,
    },
    yousef: {
      type: Number,
      default: 0,
    },
    mostafa: {
      type: Number,
      default: 0,
    },
    awad: {
      type: Number,
      default: 0,
    },
  },
  { timestamp: true }
);
//createdAt == paidAt
module.exports = mongoose.model("TeamProfit", teamProfitSchema);
