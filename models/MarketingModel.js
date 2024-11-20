const mongoose = require("mongoose");

//when return his unDirect transaction
//loop on this array and return his total profits
//calculate his total
const MarketingLogsSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["head", "marketer", "instructor"],
    },
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentDetails: {
      paymentMethod: String,
      receiverAcc: String,
    },
    //we will use this when update brokers of marketer
    totalSalesMoney: {
      type: Number,
      default: 0,
    },
    profitPercentage: {
      type: Number,
    },
    profits: {
      type: Number,
      default: 0,
    },
    salesAnalytics: [
      {
        year: Number,
        month: Number,
        analytics: [
          {
            item: String,
            amount: Number,
            percentage: Number,
          },
        ],
      },
    ],
    sales: [
      {
        purchaser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        amount: Number,
        item: String, //course or package
        Date: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    commissions: [
      {
        member: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        profit: Number,
        lastUpdate: {
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
        profitPercentage: Number,
        profits: Number,
        treeProfits: Number,
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
        paidAt: {
          type: Date,
        },
      },
    ],
    commissionsInvoices: [
      {
        profits: Number,
        desc: String,
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        status: {
          type: String,
          Enum: ["unpaid", "paid", "rejected"],
          default: "unpaid",
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
