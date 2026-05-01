const mongoose = require('mongoose');

const aiChatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const aiChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    guestKey: {
      type: String,
      index: true,
    },
    title: {
      type: String,
      default: 'New AI chat',
    },
    summary: {
      type: String,
      default: '',
    },
    recentMessages: {
      type: [aiChatMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true },
);

aiChatSessionSchema.index({ user: 1, lastMessageAt: -1 });
aiChatSessionSchema.index({ guestKey: 1, status: 1 });

module.exports = mongoose.model('AiChatSession', aiChatSessionSchema);
