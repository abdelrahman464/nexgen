const mongoose = require("mongoose");

const invitationLinkAnalyticsSchema = new mongoose.Schema(
  {
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    year: Number,
    month: Number,
    clicksCount: Number,
  },
  { timestamps: true }
);

const InvitationLinkAnalytics = mongoose.model(
  "InvitationLinkAnalytics",
  invitationLinkAnalyticsSchema
);

module.exports = InvitationLinkAnalytics;
