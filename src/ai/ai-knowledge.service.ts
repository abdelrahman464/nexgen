import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Model, Types } from 'mongoose';
import { OpenAiProviderService } from './open-ai-provider.service';

const SOURCE_TYPES = ['course', 'learningPath', 'service', 'knowledge'];

@Injectable()
export class AiKnowledgeService {
  constructor(
    @InjectModel('AiKnowledge') private readonly knowledgeModel: Model<any>,
    @InjectModel('AiKnowledgeSyncLog') private readonly syncLogModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    private readonly openAi: OpenAiProviderService,
  ) {}

  async list(query: Record<string, any> = {}) {
    const filter = this.queryFilter(query);
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      this.knowledgeModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      this.knowledgeModel.countDocuments(filter),
    ]);
    return { status: 'success', results: documents.length, total, data: documents };
  }

  async getById(id: string) {
    const knowledge = await this.knowledgeModel.findById(id);
    if (!knowledge) throw new NotFoundException('AI knowledge item not found');
    return { status: 'success', data: knowledge };
  }

  async create(body: Record<string, any>) {
    const knowledge = await this.knowledgeModel.create({ ...body, rag: { status: 'pending' } });
    return { status: 'success', data: knowledge };
  }

  async update(id: string, body: Record<string, any>) {
    const knowledge = await this.knowledgeModel.findById(id);
    if (!knowledge) throw new NotFoundException('AI knowledge item not found');
    Object.assign(knowledge, body);
    knowledge.rag = { ...(knowledge.rag?.toObject ? knowledge.rag.toObject() : knowledge.rag), status: 'pending', error: '' };
    await knowledge.save();
    return { status: 'success', data: knowledge };
  }

  async delete(id: string) {
    const knowledge = await this.knowledgeModel.findById(id);
    if (!knowledge) throw new NotFoundException('AI knowledge item not found');
    await this.openAi.deleteVectorStoreFile(knowledge.rag?.fileId, knowledge.rag?.vectorStoreId);
    await knowledge.deleteOne();
  }

  async syncStatus() {
    const [pending, synced, failed, logs] = await Promise.all([
      this.knowledgeModel.countDocuments({ 'rag.status': 'pending' }),
      this.knowledgeModel.countDocuments({ 'rag.status': 'synced' }),
      this.knowledgeModel.countDocuments({ 'rag.status': 'failed' }),
      this.syncLogModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    return { status: 'success', data: { pending, synced, failed, recentLogs: logs } };
  }

  async syncLogs(query: Record<string, any> = {}) {
    const limit = Math.min(Number(query.limit) || 30, 100);
    const logs = await this.syncLogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
    return { status: 'success', results: logs.length, data: logs };
  }

  async syncSelected(body: Record<string, any>, user: any) {
    const items = this.selectedItems(body);
    if (!items.length) throw new BadRequestException('At least one source item is required');
    return this.runWithSyncLog('sync_selected', body.mode || 'manual', user, items, () => this.syncItems(items));
  }

  async syncPending(body: Record<string, any>, user: any) {
    const items = await this.itemsByRagStatus('pending');
    return this.runWithSyncLog('sync_pending', body.mode || 'manual', user, items, () => this.syncItems(items));
  }

  async retryFailed(body: Record<string, any>, user: any) {
    const items = await this.itemsByRagStatus('failed');
    return this.runWithSyncLog('retry_failed', body.mode || 'manual', user, items, () => this.syncItems(items));
  }

  async fullRebuild(body: Record<string, any>, user: any) {
    const items = await this.allActiveItems();
    return this.runWithSyncLog('full_rebuild', body.mode || 'manual', user, items, () => this.syncItems(items, true));
  }

  private queryFilter(query: Record<string, any>) {
    const filter: Record<string, any> = {};
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.locale) filter.locale = query.locale;
    if (query.status) filter.status = query.status;
    if (query.ragStatus) filter['rag.status'] = query.ragStatus;
    if (query.keyword) {
      const regex = new RegExp(String(query.keyword).trim(), 'i');
      filter.$or = [{ 'title.en': regex }, { 'title.ar': regex }, { 'answer.en': regex }, { 'answer.ar': regex }, { 'content.en': regex }, { 'content.ar': regex }];
    }
    return filter;
  }

  private selectedItems(body: Record<string, any>) {
    if (Array.isArray(body.items)) return body.items.map((item) => this.normalizeItem(item)).filter(Boolean);
    const item = this.normalizeItem({ sourceType: body.sourceType, sourceId: body.sourceId });
    return item ? [item] : [];
  }

  private normalizeItem(item: any) {
    if (!SOURCE_TYPES.includes(item?.sourceType) || !Types.ObjectId.isValid(item?.sourceId)) return null;
    return { sourceType: item.sourceType, sourceId: String(item.sourceId) };
  }

  private async itemsByRagStatus(status: string) {
    const limit = this.openAi.syncLimit;
    const knowledge = await this.knowledgeModel.find({ status: 'active', 'rag.status': status }).select('_id').limit(limit).lean();
    return knowledge.map((item: any) => ({ sourceType: 'knowledge', sourceId: item._id.toString() }));
  }

  private async allActiveItems() {
    const limit = this.openAi.syncLimit;
    const [courses, learningPaths, services, knowledge] = await Promise.all([
      this.courseModel.find({ status: 'active' }).select('_id').limit(limit).lean(),
      this.coursePackageModel.find({ status: 'active' }).select('_id').limit(limit).lean(),
      this.packageModel.find({ status: 'active', type: 'service' }).select('_id').limit(limit).lean(),
      this.knowledgeModel.find({ status: 'active' }).select('_id').limit(limit).lean(),
    ]);
    return [
      ...courses.map((item: any) => ({ sourceType: 'course', sourceId: item._id.toString() })),
      ...learningPaths.map((item: any) => ({ sourceType: 'learningPath', sourceId: item._id.toString() })),
      ...services.map((item: any) => ({ sourceType: 'service', sourceId: item._id.toString() })),
      ...knowledge.map((item: any) => ({ sourceType: 'knowledge', sourceId: item._id.toString() })),
    ].slice(0, limit);
  }

  private async syncItems(items: any[], force = false) {
    const results: any[] = [];
    for (const item of items) {
      results.push(await this.syncOne(item, force));
    }
    return results;
  }

  private async syncOne(item: any, force = false) {
    try {
      const source = await this.findSource(item);
      if (!source) return { ...item, status: 'skipped', reason: 'Source not found or inactive' };
      const text = this.buildDocument(item.sourceType, source);
      const contentHash = crypto.createHash('sha256').update(text).digest('hex');
      if (!force && source.rag?.contentHash === contentHash && source.rag?.status === 'synced') {
        return { ...item, status: 'unchanged', reason: 'Content already synced' };
      }
      await this.openAi.deleteVectorStoreFile(source.rag?.fileId, source.rag?.vectorStoreId);
      const vectorStoreId = this.openAi.requireVectorStoreId();
      const uploaded = await this.uploadText(text, item);
      await this.markRag(item, {
        fileId: uploaded.id,
        vectorStoreId,
        contentHash,
        syncedAt: new Date(),
        status: 'synced',
        error: '',
      });
      return { ...item, status: 'synced' };
    } catch (error: any) {
      await this.markRag(item, { status: 'failed', error: error.message || 'Sync failed' }).catch(() => undefined);
      return { ...item, status: 'failed', error: error.message || 'Sync failed' };
    }
  }

  private async findSource(item: any) {
    if (item.sourceType === 'course') return this.courseModel.findOne({ _id: item.sourceId, status: 'active' }).lean();
    if (item.sourceType === 'learningPath') return this.coursePackageModel.findOne({ _id: item.sourceId, status: 'active' }).lean();
    if (item.sourceType === 'service') return this.packageModel.findOne({ _id: item.sourceId, status: 'active', type: 'service' }).lean();
    return this.knowledgeModel.findOne({ _id: item.sourceId, status: 'active' }).lean();
  }

  private async markRag(item: any, rag: Record<string, any>) {
    const model = item.sourceType === 'course' ? this.courseModel : item.sourceType === 'learningPath' ? this.coursePackageModel : item.sourceType === 'service' ? this.packageModel : this.knowledgeModel;
    await model.findByIdAndUpdate(item.sourceId, { $set: { rag } });
  }

  private async uploadText(text: string, item: any) {
    const directory = join(tmpdir(), 'nexgen-ai-sync');
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const filePath = join(directory, `${item.sourceType}-${item.sourceId}-${Date.now()}.txt`);
    writeFileSync(filePath, text);
    try {
      return await this.openAi.uploadVectorTextFile(this.openAi.requireVectorStoreId(), filePath);
    } finally {
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  }

  private buildDocument(sourceType: string, source: any) {
    if (sourceType === 'knowledge') {
      return [
        `Source Type: knowledge`,
        `Source ID: ${source._id}`,
        `Title EN: ${source.title?.en || ''}`,
        `Title AR: ${source.title?.ar || ''}`,
        `Category: ${source.category || ''}`,
        `Answer EN: ${source.answer?.en || ''}`,
        `Answer AR: ${source.answer?.ar || ''}`,
        `Content EN: ${source.content?.en || ''}`,
        `Content AR: ${source.content?.ar || ''}`,
        `Questions: ${(source.questionExamples || []).map((question: any) => `${question.en || ''} ${question.ar || ''}`).join(' | ')}`,
      ].join('\n');
    }
    return [
      `Source Type: ${sourceType}`,
      `Source ID: ${source._id}`,
      `Title EN: ${source.title?.en || source.title || ''}`,
      `Title AR: ${source.title?.ar || ''}`,
      `Description EN: ${source.description?.en || source.description || ''}`,
      `Description AR: ${source.description?.ar || ''}`,
      `Slug: ${source.slug || ''}`,
      `Price: ${source.price || ''}`,
      `Price After Discount: ${source.priceAfterDiscount || ''}`,
      `Category: ${source.category?.title?.en || source.category?.title || ''}`,
    ].join('\n');
  }

  private async runWithSyncLog(action: string, mode: string, user: any, items: any[], callback: () => Promise<any[]>) {
    const startedAt = new Date();
    const vectorStoreId = this.openAi.vectorStoreId;
    const log = await this.syncLogModel.create({
      action,
      mode,
      vectorStoreId,
      triggeredBy: user?._id,
      sourceCount: items.length,
      startedAt,
      items: items.map((item) => ({ ...item, status: 'running' })),
    });
    try {
      const results = await callback();
      const summary = this.summary(results);
      log.status = summary.failed ? 'completed_with_errors' : 'success';
      log.summary = summary;
      log.items = results;
      log.completedAt = new Date();
      log.durationMs = log.completedAt.getTime() - startedAt.getTime();
      await log.save();
      return { status: 'success', data: { summary, items: results, log } };
    } catch (error: any) {
      log.status = 'failed';
      log.error = error.message || 'Sync failed';
      log.completedAt = new Date();
      log.durationMs = log.completedAt.getTime() - startedAt.getTime();
      await log.save();
      throw error;
    }
  }

  private summary(results: any[]) {
    return results.reduce(
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
  }
}
