const mongoose = require("mongoose");

//when return his unDirect transaction
//loop on this array and return his total profits
//calculate his total
const MarketingLogsSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["customer", "marketer", "instructor"],
    },
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    //to determine if this marketer has sent request to be a marketer
    hasSentRequest: {
      type: Boolean,
      default: false,
    },
    //we will use this when update brokers of marketer
    totalSalesMoney: {
      type: Number,
      default: 0,
    },
    direct_transactions: [
      {
        child: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        percentage: Number,
        amount: Number,
        profit: Number,
        item: String, //course or package
        Date: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    transactions: [
      {
        child: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        percentage: Number,
        amount: Number,
        profit: Number,
        item: String, //course or package
        Date: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    wallet: [
      {
        member: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        percentage: Number,
        amount: Number,
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
        totalSalesMoney: Number,
        mySales: Number,
        profits: Number,
        treeProfits: Number,
        desc: String,
        paymentMethod: {
          type: String,
        },
        receiverAcc: {
          type: String,
        },
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        status: {
          type: String,
          Enum: ["unpaid", "paid"],
          default: "unpaid",
        },
        paidAt: {
          type: Date,
        },
      },
    ],
    walletInvoices: [
      {
        profits: Number,
        desc: String,
        reasonToWithdraw: String,
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        status: {
          type: String,
          Enum: ["unpaid", "paid", "rejected"],
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

const MarketingLog = mongoose.model("MarketingLogs", MarketingLogsSchema);

module.exports = MarketingLog;
