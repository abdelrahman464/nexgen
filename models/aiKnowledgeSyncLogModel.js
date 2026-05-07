const mongoose = require('mongoose');

const aiKnowledgeSyncLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['sync_selected', 'sync_pending', 'retry_failed', 'full_rebuild'],
      required: true,
    },
    mode: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['running', 'success', 'completed_with_errors', 'failed'],
      default: 'running',
    },
    vectorStoreId: String,
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sourceCount: {
      type: Number,
      default: 0,
    },
    summary: {
      total: { type: Number, default: 0 },
      synced: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      unchanged: { type: Number, default: 0 },
    },
    items: [
      {
        sourceType: String,
        sourceId: String,
        status: String,
        error: String,
        reason: String,
      },
    ],
    error: String,
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    durationMs: Number,
  },
  { timestamps: true },
);

aiKnowledgeSyncLogSchema.index({ createdAt: -1 });
aiKnowledgeSyncLogSchema.index({ mode: 1, action: 1, status: 1 });

module.exports =
  mongoose.models.AiKnowledgeSyncLog ||
  mongoose.model('AiKnowledgeSyncLog', aiKnowledgeSyncLogSchema);
