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
    clicks: [
      {
        month: String,
        year: Number,
        count: Number,
      },
    ],
    sales: [
      {
        purchaser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        amount: Number,
        itemType: String, //course or package
        item: { type: String, i18n: true }, //course or package
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
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        status: {
          type: String,
          Enum: ["pending", "paid"],
          default: "pending",
        },
        paidAt: {
          type: Date,
        },
      },
    ],
    walletInvoices: [
      {
        profits: Number,
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
