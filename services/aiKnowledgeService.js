const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const AiKnowledge = require('../models/aiKnowledgeModel');
const AiKnowledgeSyncLog = require('../models/aiKnowledgeSyncLogModel');
const Course = require('../models/courseModel');
const CoursePackage = require('../models/coursePackageModel');
const Package = require('../models/packageModel');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SOURCE_TYPES = ['course', 'learningPath', 'service', 'knowledge'];
const SYNC_LIMIT = Number(process.env.AI_KNOWLEDGE_SYNC_LIMIT) || 25;

const getVectorStoreId = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError('OpenAI API key is not configured', 500);
  }
  if (!process.env.OPENAI_VECTOR_STORE_ID) {
    throw new ApiError('OPENAI_VECTOR_STORE_ID is not configured', 500);
  }
  return process.env.OPENAI_VECTOR_STORE_ID;
};

const normalizeLocalized = (value) => {
  if (!value) return { en: '', ar: '' };
  if (typeof value === 'string') return { en: value, ar: value };
  if (typeof value === 'object') {
    return {
      en: value.en || value.localized || '',
      ar: value.ar || value.localized || '',
    };
  }
  return { en: String(value), ar: String(value) };
};

const localizedLine = (label, value) => {
  const text = normalizeLocalized(value);
  return [`${label} EN: ${text.en || '-'}`, `${label} AR: ${text.ar || '-'}`];
};

const arrayLines = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return [`${label}: -`];
  return [
    `${label}:`,
    ...items
      .map((item, index) => {
        const text = normalizeLocalized(item);
        return `${index + 1}. EN: ${text.en || '-'} | AR: ${text.ar || '-'}`;
      })
      .filter(Boolean),
  ];
};

const getPlainTitle = (value) => {
  const text = normalizeLocalized(value);
  return text.en || text.ar || 'Untitled';
};

const hashContent = (content) =>
  crypto.createHash('sha256').update(content).digest('hex');

const compact = (value, fallback = '-') => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
};

const getUrlPath = (sourceType, slug) => {
  if (!slug) return '';
  if (sourceType === 'course') return `/courses/${slug}`;
  if (sourceType === 'learningPath') return `/learning-paths/${slug}`;
  if (sourceType === 'service') return `/services/${slug}`;
  return '';
};

const isActive = (doc) => doc?.status === 'active';

const getRagStatusFilter = (status) => {
  if (status === 'pending') {
    return {
      $or: [
        { 'rag.status': 'pending' },
        { rag: { $exists: false } },
        { 'rag.status': { $exists: false } },
      ],
    };
  }
  return { 'rag.status': status };
};

const combineFilters = (...filters) => {
  const cleanFilters = filters.filter(
    (filter) => filter && Object.keys(filter).length > 0,
  );
  if (cleanFilters.length === 0) return {};
  if (cleanFilters.length === 1) return cleanFilters[0];
  return { $and: cleanFilters };
};

const addSharedCatalogLines = (sourceType, doc) => {
  const urlPath = getUrlPath(sourceType, doc.slug);
  const category = doc.category?.title || doc.course?.category?.title;
  return [
    `Source Type: ${sourceType}`,
    `Source ID: ${doc._id}`,
    `Status: ${doc.status}`,
    `Slug: ${compact(doc.slug)}`,
    `Public URL Path: ${compact(urlPath)}`,
    ...localizedLine('Title', doc.title),
    ...localizedLine('Description', doc.description),
    ...localizedLine('Category', category),
    `Price: ${compact(doc.price)}`,
    `Price After Discount: ${compact(doc.priceAfterDiscount)}`,
    `Level or Type: ${compact(doc.type)}`,
    `Course Duration: ${compact(doc.courseDuration)}`,
    `Subscription Duration Days: ${compact(doc.subscriptionDurationDays)}`,
    ...arrayLines('Highlights', doc.highlights),
    ...arrayLines('What users will learn', doc.whatWillLearn),
    ...arrayLines('Prerequisites', doc.coursePrerequisites),
    ...arrayLines('Best for', doc.whoThisCourseFor),
  ];
};

const buildCourseRagDocument = (course) => ({
  sourceType: 'course',
  sourceId: course._id.toString(),
  title: getPlainTitle(course.title),
  slug: course.slug,
  urlPath: getUrlPath('course', course.slug),
  content: [
    'Nexgen Academy searchable catalog item.',
    'Use this item only when it strongly matches the user need.',
    ...addSharedCatalogLines('course', course),
  ].join('\n'),
});

const buildLearningPathRagDocument = (coursePackage) => {
  const includedCourses = Array.isArray(coursePackage.courses)
    ? coursePackage.courses
        .map((course, index) => {
          const title = normalizeLocalized(course?.title);
          return `${index + 1}. EN: ${title.en || '-'} | AR: ${title.ar || '-'}`;
        })
        .join('\n')
    : '-';

  return {
    sourceType: 'learningPath',
    sourceId: coursePackage._id.toString(),
    title: getPlainTitle(coursePackage.title),
    slug: coursePackage.slug,
    urlPath: getUrlPath('learningPath', coursePackage.slug),
    content: [
      'Nexgen Academy searchable learning path.',
      'Prefer this item for users asking for a roadmap, plan, full path, sequence, or guided program when it matches the topic.',
      ...addSharedCatalogLines('learningPath', coursePackage),
      `Included Courses:\n${includedCourses}`,
    ].join('\n'),
  };
};

const buildServiceRagDocument = (packageDoc) => ({
  sourceType: 'service',
  sourceId: packageDoc._id.toString(),
  title: getPlainTitle(packageDoc.title),
  slug: packageDoc.slug,
  urlPath: getUrlPath('service', packageDoc.slug),
  content: [
    'Nexgen Academy searchable service/subscription item.',
    'Prefer this item for users asking for mentorship, subscription access, live support, signals, help, or platform/service features when it matches the topic.',
    ...addSharedCatalogLines('service', packageDoc),
    ...localizedLine('Related Course', packageDoc.course?.title),
  ].join('\n'),
});

const buildKnowledgeRagDocument = (knowledge) => {
  const title = normalizeLocalized(knowledge.title);
  const questions = Array.isArray(knowledge.questionExamples)
    ? knowledge.questionExamples
        .map((question, index) => {
          const text = normalizeLocalized(question);
          return `${index + 1}. EN: ${text.en || '-'} | AR: ${text.ar || '-'}`;
        })
        .join('\n')
    : '-';

  return {
    sourceType: 'knowledge',
    sourceId: knowledge._id.toString(),
    title: title.en || title.ar || 'Knowledge document',
    slug: '',
    urlPath: '',
    content: [
      'Nexgen Academy internal support and FAQ knowledge.',
      'Use this to answer support, policy, account, subscription, and product questions. This is not a clickable catalog recommendation.',
      `Source Type: knowledge`,
      `Source ID: ${knowledge._id}`,
      `Status: ${knowledge.status}`,
      `Knowledge Type: ${knowledge.type}`,
      `Locale: ${knowledge.locale}`,
      `Category: ${compact(knowledge.category)}`,
      ...localizedLine('Title', knowledge.title),
      `Question Examples:\n${questions}`,
      ...localizedLine('Answer', knowledge.answer),
      ...localizedLine('Raw Content', knowledge.content),
    ].join('\n'),
  };
};

const getBuilder = (sourceType) => {
  if (sourceType === 'course') return buildCourseRagDocument;
  if (sourceType === 'learningPath') return buildLearningPathRagDocument;
  if (sourceType === 'service') return buildServiceRagDocument;
  if (sourceType === 'knowledge') return buildKnowledgeRagDocument;
  throw new ApiError('Unsupported AI knowledge source type', 400);
};

const getModel = (sourceType) => {
  if (sourceType === 'course') return Course;
  if (sourceType === 'learningPath') return CoursePackage;
  if (sourceType === 'service') return Package;
  if (sourceType === 'knowledge') return AiKnowledge;
  throw new ApiError('Unsupported AI knowledge source type', 400);
};

const findSourceById = async (sourceType, sourceId) => {
  const Model = getModel(sourceType);
  let query = Model.findById(sourceId);

  if (sourceType === 'course') {
    query = query.populate({ path: 'category', select: 'title' });
  }
  if (sourceType === 'learningPath') {
    query = query
      .populate({ path: 'category', select: 'title' })
      .populate({ path: 'courses', select: 'title courseDuration slug status' });
  }
  if (sourceType === 'service') {
    query = query
      .populate({ path: 'category', select: 'title' })
      .populate({ path: 'course', select: 'title category slug status' });
  }

  return query;
};

const findSourcesForSync = async (sourceType, ragStatus) => {
  const Model = getModel(sourceType);
  const baseFilter = sourceType === 'service' ? { type: 'service' } : {};
  const filter = combineFilters(
    baseFilter,
    ragStatus ? getRagStatusFilter(ragStatus) : {},
  );

  let query = Model.find(filter).limit(SYNC_LIMIT);
  if (sourceType === 'course') {
    query = query.populate({ path: 'category', select: 'title' });
  }
  if (sourceType === 'learningPath') {
    query = query
      .populate({ path: 'category', select: 'title' })
      .populate({ path: 'courses', select: 'title courseDuration slug status' });
  }
  if (sourceType === 'service') {
    query = query
      .populate({ path: 'category', select: 'title' })
      .populate({ path: 'course', select: 'title category slug status' });
  }

  return query;
};

const markRag = async (sourceType, sourceId, rag) => {
  const Model = getModel(sourceType);
  return Model.findByIdAndUpdate(
    sourceId,
    {
      $set: {
        rag,
      },
    },
    { new: true },
  );
};

const deleteVectorStoreFile = async (fileId, vectorStoreId) => {
  if (!fileId || !vectorStoreId) return;
  try {
    await openai.vectorStores.files.delete(fileId, {
      vector_store_id: vectorStoreId,
    });
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
};

const uploadTextDocument = async (document, vectorStoreId) => {
  const tempPath = path.join(
    os.tmpdir(),
    `nexgen-ai-${document.sourceType}-${document.sourceId}-${Date.now()}.txt`,
  );
  await fs.promises.writeFile(tempPath, document.content, 'utf8');
  try {
    const upload = await openai.vectorStores.files.uploadAndPoll(
      vectorStoreId,
      fs.createReadStream(tempPath),
      { pollIntervalMs: 1000 },
    );
    if (upload.status !== 'completed') {
      throw new Error(upload.last_error?.message || 'Vector file processing failed');
    }
    return upload;
  } finally {
    await fs.promises.unlink(tempPath).catch(() => {});
  }
};

const syncOneSource = async (sourceType, sourceId) => {
  const vectorStoreId = getVectorStoreId();
  const source = await findSourceById(sourceType, sourceId);
  if (!source) {
    throw new ApiError('AI knowledge source not found', 404);
  }

  const existingRag = source.rag || {};
  const isCatalog = ['course', 'learningPath', 'service'].includes(sourceType);
  const sourceIsActive = isActive(source) && (!isCatalog || sourceType !== 'service' || source.type === 'service');

  if (!sourceIsActive) {
    await deleteVectorStoreFile(existingRag.fileId, existingRag.vectorStoreId || vectorStoreId);
    await markRag(sourceType, source._id, {
      fileId: null,
      vectorStoreId,
      contentHash: null,
      syncedAt: new Date(),
      status: 'synced',
      error: '',
    });
    return {
      sourceType,
      sourceId: source._id.toString(),
      status: 'skipped',
      reason: 'Source is not active',
    };
  }

  const document = getBuilder(sourceType)(source);
  const contentHash = hashContent(document.content);

  if (
    existingRag.status === 'synced' &&
    existingRag.contentHash === contentHash &&
    existingRag.vectorStoreId === vectorStoreId &&
    existingRag.fileId
  ) {
    return {
      sourceType,
      sourceId: source._id.toString(),
      status: 'unchanged',
      fileId: existingRag.fileId,
    };
  }

  try {
    await deleteVectorStoreFile(existingRag.fileId, existingRag.vectorStoreId || vectorStoreId);
    const upload = await uploadTextDocument(document, vectorStoreId);
    await markRag(sourceType, source._id, {
      fileId: upload.id,
      vectorStoreId,
      contentHash,
      syncedAt: new Date(),
      status: 'synced',
      error: '',
    });
    return {
      sourceType,
      sourceId: source._id.toString(),
      status: 'synced',
      fileId: upload.id,
    };
  } catch (error) {
    await markRag(sourceType, source._id, {
      ...existingRag,
      vectorStoreId,
      contentHash,
      syncedAt: new Date(),
      status: 'failed',
      error: error.message || 'AI knowledge sync failed',
    });
    return {
      sourceType,
      sourceId: source._id.toString(),
      status: 'failed',
      error: error.message || 'AI knowledge sync failed',
    };
  }
};

const syncByStatus = async (ragStatus) => {
  const results = [];
  for (const sourceType of SOURCE_TYPES) {
    const sources = await findSourcesForSync(sourceType, ragStatus);
    for (const source of sources) {
      results.push(await syncOneSource(sourceType, source._id));
    }
  }
  return results;
};

const syncAllActiveSources = async () => {
  const results = [];
  for (const sourceType of SOURCE_TYPES) {
    const baseFilter = sourceType === 'service' ? { type: 'service' } : {};
    const filter = combineFilters(baseFilter, {
      $or: [
        { status: 'active' },
        { 'rag.fileId': { $exists: true, $nin: [null, ''] } },
      ],
    });
    const Model = getModel(sourceType);
    const sources = await Model.find(filter).select('_id').limit(10000);
    for (const source of sources) {
      results.push(await syncOneSource(sourceType, source._id));
    }
  }
  return results;
};

const summarizeSyncResults = (results) =>
  (results || []).reduce(
    (summary, result) => {
      summary.total += 1;
      if (result.status === 'synced') summary.synced += 1;
      if (result.status === 'failed') summary.failed += 1;
      if (result.status === 'skipped') summary.skipped += 1;
      if (result.status === 'unchanged') summary.unchanged += 1;
      return summary;
    },
    { total: 0, synced: 0, failed: 0, skipped: 0, unchanged: 0 },
  );

const runWithSyncLog = async (req, action, sourceCount, syncHandler) => {
  const startedAt = new Date();
  const log = await AiKnowledgeSyncLog.create({
    action,
    mode: req.body?.mode === 'auto' ? 'auto' : 'manual',
    status: 'running',
    vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
    triggeredBy: req.user?._id,
    sourceCount,
    startedAt,
  });

  try {
    const results = await syncHandler();
    const completedAt = new Date();
    const summary = summarizeSyncResults(results);
    log.status = summary.failed > 0 ? 'completed_with_errors' : 'success';
    log.summary = summary;
    log.items = results.slice(0, 200).map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      status: item.status,
      error: item.error,
      reason: item.reason,
    }));
    log.completedAt = completedAt;
    log.durationMs = completedAt.getTime() - startedAt.getTime();
    await log.save();
    return results;
  } catch (error) {
    const completedAt = new Date();
    log.status = 'failed';
    log.error = error.message || 'AI knowledge sync failed';
    log.completedAt = completedAt;
    log.durationMs = completedAt.getTime() - startedAt.getTime();
    await log.save();
    throw error;
  }
};

const getQueryFilter = (query) => {
  const filter = {};
  if (query.type && query.type !== 'all') filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.locale && query.locale !== 'all') filter.locale = query.locale;
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.ragStatus && query.ragStatus !== 'all') {
    filter['rag.status'] = query.ragStatus;
  }
  if (query.keyword) {
    const textPattern = new RegExp(query.keyword, 'i');
    filter.$or = [
      { 'title.en': textPattern },
      { 'title.ar': textPattern },
      { 'answer.en': textPattern },
      { 'answer.ar': textPattern },
      { 'content.en': textPattern },
      { 'content.ar': textPattern },
      { category: textPattern },
    ];
  }
  return filter;
};

exports.getAiKnowledge = asyncHandler(async (req, res) => {
  const filter = getQueryFilter(req.query);
  const documents = await AiKnowledge.find(filter).sort({ updatedAt: -1 });
  res.status(200).json({
    status: 'success',
    results: documents.length,
    data: documents,
  });
});

exports.getAiKnowledgeById = asyncHandler(async (req, res, next) => {
  const document = await AiKnowledge.findById(req.params.id);
  if (!document) return next(new ApiError('AI knowledge document not found', 404));
  return res.status(200).json({ status: 'success', data: document });
});

exports.createAiKnowledge = asyncHandler(async (req, res) => {
  const document = await AiKnowledge.create(req.body);
  res.status(201).json({ status: 'success', data: document });
});

exports.updateAiKnowledge = asyncHandler(async (req, res, next) => {
  const { rag, ...safeBody } = req.body;
  const document = await AiKnowledge.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        ...safeBody,
        'rag.status': 'pending',
        'rag.error': '',
      },
    },
    { new: true, runValidators: true },
  );
  if (!document) return next(new ApiError('AI knowledge document not found', 404));
  return res.status(200).json({ status: 'success', data: document });
});

exports.deleteAiKnowledge = asyncHandler(async (req, res, next) => {
  const document = await AiKnowledge.findById(req.params.id);
  if (!document) return next(new ApiError('AI knowledge document not found', 404));
  const vectorStoreId = document.rag?.vectorStoreId || process.env.OPENAI_VECTOR_STORE_ID;
  if (document.rag?.fileId && vectorStoreId && process.env.OPENAI_API_KEY) {
    await deleteVectorStoreFile(document.rag.fileId, vectorStoreId).catch(() => {});
  }
  await document.deleteOne();
  return res.status(204).send();
});

exports.getSyncStatus = asyncHandler(async (req, res) => {
  const sourceSummaries = await Promise.all(
    SOURCE_TYPES.map(async (sourceType) => {
      const Model = getModel(sourceType);
      const baseFilter = sourceType === 'service' ? { type: 'service' } : {};
      const [total, pending, synced, failed] = await Promise.all([
        Model.countDocuments(baseFilter),
        Model.countDocuments(combineFilters(baseFilter, getRagStatusFilter('pending'))),
        Model.countDocuments({ ...baseFilter, 'rag.status': 'synced' }),
        Model.countDocuments({ ...baseFilter, 'rag.status': 'failed' }),
      ]);
      return { sourceType, total, pending, synced, failed };
    }),
  );

  const totals = sourceSummaries.reduce(
    (acc, item) => ({
      total: acc.total + item.total,
      pending: acc.pending + item.pending,
      synced: acc.synced + item.synced,
      failed: acc.failed + item.failed,
    }),
    { total: 0, pending: 0, synced: 0, failed: 0 },
  );

  const failedItems = [];
  for (const sourceType of SOURCE_TYPES) {
    const Model = getModel(sourceType);
    const filter = { 'rag.status': 'failed' };
    if (sourceType === 'service') filter.type = 'service';
    const items = await Model.find(filter)
      .select('title slug status rag type updatedAt')
      .sort({ 'rag.syncedAt': -1 })
      .limit(10);
    failedItems.push(
      ...items.map((item) => ({
        sourceType,
        sourceId: item._id,
        title: item.title,
        slug: item.slug,
        status: item.status,
        rag: item.rag,
      })),
    );
  }

  return res.status(200).json({
    status: 'success',
    data: {
      vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
      totals,
      sources: sourceSummaries,
      failedItems,
    },
  });
});

exports.getSyncLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const logs = await AiKnowledgeSyncLog.find({})
    .populate({ path: 'triggeredBy', select: 'name email' })
    .sort({ createdAt: -1 })
    .limit(limit);

  return res.status(200).json({
    status: 'success',
    results: logs.length,
    data: logs,
  });
});

exports.syncSelected = asyncHandler(async (req, res, next) => {
  const items = Array.isArray(req.body.items)
    ? req.body.items
    : [{ sourceType: req.body.sourceType, sourceId: req.body.sourceId }];

  if (
    items.length === 0 ||
    items.some((item) => !SOURCE_TYPES.includes(item.sourceType) || !item.sourceId)
  ) {
    return next(new ApiError('sourceType and sourceId are required', 400));
  }

  const results = await runWithSyncLog(
    req,
    'sync_selected',
    items.length,
    async () => {
      const syncedItems = [];
      for (const item of items) {
        syncedItems.push(await syncOneSource(item.sourceType, item.sourceId));
      }
      return syncedItems;
    },
  );

  return res.status(200).json({ status: 'success', data: { results } });
});

exports.syncPending = asyncHandler(async (req, res) => {
  const results = await runWithSyncLog(req, 'sync_pending', 0, () =>
    syncByStatus('pending'),
  );
  return res.status(200).json({ status: 'success', data: { results } });
});

exports.retryFailed = asyncHandler(async (req, res) => {
  const results = await runWithSyncLog(req, 'retry_failed', 0, () =>
    syncByStatus('failed'),
  );
  return res.status(200).json({ status: 'success', data: { results } });
});

exports.fullRebuild = asyncHandler(async (req, res) => {
  const results = await runWithSyncLog(req, 'full_rebuild', 0, () =>
    syncAllActiveSources(),
  );
  return res.status(200).json({ status: 'success', data: { results } });
});
