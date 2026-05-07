import { Schema } from 'mongoose';

const aiChatMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const AiChatSessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    guestKey: { type: String, index: true },
    title: { type: String, default: 'New AI chat' },
    summary: { type: String, default: '' },
    recentMessages: { type: [aiChatMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
);
AiChatSessionSchema.index({ user: 1, lastMessageAt: -1 });
AiChatSessionSchema.index({ guestKey: 1, status: 1 });

const ragSyncSchema = new Schema(
  {
    fileId: String,
    vectorStoreId: String,
    contentHash: String,
    syncedAt: Date,
    status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
    error: String,
  },
  { _id: false },
);

const localizedStringSchema = new Schema({ en: String, ar: String }, { _id: false });

export const AiKnowledgeSchema = new Schema(
  {
    title: { type: localizedStringSchema, required: true },
    type: { type: String, enum: ['faq', 'raw_doc'], default: 'faq', required: true },
    questionExamples: { type: [localizedStringSchema], default: [] },
    answer: localizedStringSchema,
    content: localizedStringSchema,
    category: String,
    locale: { type: String, enum: ['en', 'ar', 'both'], default: 'both' },
    status: { type: String, enum: ['active', 'inActive', 'pending'], default: 'active' },
    rag: { type: ragSyncSchema, default: () => ({ status: 'pending' }) },
  },
  { timestamps: true },
);
AiKnowledgeSchema.index({ type: 1, status: 1 });
AiKnowledgeSchema.index({ category: 1 });
AiKnowledgeSchema.index({ 'rag.status': 1 });
AiKnowledgeSchema.pre('save', function (this: any, next) {
  if (
    this.isNew ||
    this.isModified('title') ||
    this.isModified('type') ||
    this.isModified('questionExamples') ||
    this.isModified('answer') ||
    this.isModified('content') ||
    this.isModified('category') ||
    this.isModified('locale') ||
    this.isModified('status')
  ) {
    this.rag = { ...(this.rag?.toObject ? this.rag.toObject() : this.rag), status: 'pending', error: '' };
  }
  next();
});

export const AiKnowledgeSyncLogSchema = new Schema(
  {
    action: { type: String, enum: ['sync_selected', 'sync_pending', 'retry_failed', 'full_rebuild'], required: true },
    mode: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    status: { type: String, enum: ['running', 'success', 'completed_with_errors', 'failed'], default: 'running' },
    vectorStoreId: String,
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sourceCount: { type: Number, default: 0 },
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
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    durationMs: Number,
  },
  { timestamps: true },
);
AiKnowledgeSyncLogSchema.index({ createdAt: -1 });
AiKnowledgeSyncLogSchema.index({ mode: 1, action: 1, status: 1 });
