const mongoose = require('mongoose');

const ragSyncSchema = new mongoose.Schema(
  {
    fileId: String,
    vectorStoreId: String,
    contentHash: String,
    syncedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending',
    },
    error: String,
  },
  { _id: false },
);

const localizedStringSchema = new mongoose.Schema(
  {
    en: String,
    ar: String,
  },
  { _id: false },
);

const aiKnowledgeSchema = new mongoose.Schema(
  {
    title: {
      type: localizedStringSchema,
      required: true,
    },
    type: {
      type: String,
      enum: ['faq', 'raw_doc'],
      default: 'faq',
      required: true,
    },
    questionExamples: {
      type: [localizedStringSchema],
      default: [],
    },
    answer: localizedStringSchema,
    content: localizedStringSchema,
    category: String,
    locale: {
      type: String,
      enum: ['en', 'ar', 'both'],
      default: 'both',
    },
    status: {
      type: String,
      enum: ['active', 'inActive', 'pending'],
      default: 'active',
    },
    rag: {
      type: ragSyncSchema,
      default: () => ({ status: 'pending' }),
    },
  },
  {
    timestamps: true,
  },
);

aiKnowledgeSchema.index({ type: 1, status: 1 });
aiKnowledgeSchema.index({ category: 1 });
aiKnowledgeSchema.index({ 'rag.status': 1 });

aiKnowledgeSchema.pre('save', function (next) {
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
    this.rag = {
      ...(this.rag?.toObject ? this.rag.toObject() : this.rag),
      status: 'pending',
      error: '',
    };
  }
  next();
});

module.exports =
  mongoose.models.AiKnowledge || mongoose.model('AiKnowledge', aiKnowledgeSchema);
