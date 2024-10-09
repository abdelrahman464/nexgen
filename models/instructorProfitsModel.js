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
    profits: [
      {
        purchaser: {
          //purchaser
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        course: String,
        profit: Number,
        Date: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    //when we pay to marketer we save invoice here
    invoices: [
      {
        profits: Number,
        desc: String,
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        status: {
          type: String,
          Enum: ["unpaid", "paid"],
          default: "unpaid",
        },
        //these two parameters
        paymentMethod: {
          type: String,
        },
        receiverAcc: {
          type: String,
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
