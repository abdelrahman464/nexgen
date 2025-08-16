const mongoose = require("mongoose");

//when return his unDirect transaction
//loop on this array and return his total profits
//calculate his total
const InstructorProfitsSchema = new mongoose.Schema(
  {
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    totalSalesMoney: {
      type: Number,
      default: 0,
    },
    profits: {
      type: Number,
      default: 0,
    },
    commissions: [
      {
        order: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        percentage: Number,
        profit: Number,
        createdAt: {
          type: Date,
          default: new Date(),
        },
      },
    ],
    //payment details for withdrawing profits
    paymentMethod: {
      type: String,
    },
    receiverAcc: {
      type: String,
    },
    //when we pay to marketer we save invoice here
    invoices: [
      {
        profits: Number,
        desc: String,
        status: {
          type: String,
          Enum: ["unpaid", "paid"],
          default: "unpaid",
        },
        createdAt: {
          type: Date,
          default: new Date(),
        },
        paidAt: {
          type: Date,
        },
      },
    ],
  },
  { timestamps: true }
);

const InstructorProfit = mongoose.model(
  "InstructorProfits",
  InstructorProfitsSchema
);

module.exports = InstructorProfit;
