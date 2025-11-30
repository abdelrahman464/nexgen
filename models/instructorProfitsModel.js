const mongoose = require("mongoose");

//when return his unDirect transaction
//loop on this array and return his total profits
//calculate his total
const commissionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    type: String,
    amount: Number,
    percentage: Number,
    totalProfits: Number,
    profit: Number,
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    marketerPercentage: Number,
    marketerProfits: Number,
    createdAt: {
      type: Date,
      default: Date.now, // Don't call `new Date()` here
    },
  },
  { _id: false } // Optional: if you don't want _id for subdocs
);
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
    withdrawals: {
      type: Number,
      default: 0,
    },
    commissions: [commissionSchema],
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
InstructorProfitsSchema.pre(/^find/, function(next){
    this.populate({ path: "commissions.marketer", select: "name email profileImg" })
  next();
});
const InstructorProfit = mongoose.model(
  "InstructorProfits",
  InstructorProfitsSchema
);

module.exports = InstructorProfit;
