import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { AiChatService } from '../src/ai/ai-chat.service';
import { AiKnowledgeService } from '../src/ai/ai-knowledge.service';
import { AiChatDto, CreateAiKnowledgeDto } from '../src/ai/dto/ai.dto';
import { IdentityVerificationService } from '../src/ai/identity-verification.service';
import { ApiException } from '../src/common/exceptions/api.exception';

const objectId = () => new Types.ObjectId().toString();

describe('AI and knowledge migration smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_VECTOR_STORE_ID = 'vector-store';
  });

  it('validates AI chat and knowledge DTOs', async () => {
    const chatErrors = await validate(Object.assign(new AiChatDto(), {}));
    const knowledgeErrors = await validate(Object.assign(new CreateAiKnowledgeDto(), { locale: 'fr' }));

    expect(chatErrors.map((error) => error.property)).toContain('messages');
    expect(knowledgeErrors.map((error) => error.property)).toEqual(expect.arrayContaining(['title', 'locale']));
  });

  it('creates a protected AI chat session with the legacy response envelope', async () => {
    const session = { _id: objectId(), title: 'New AI chat' };
    const sessionModel = { create: jest.fn().mockResolvedValue(session) };
    const service = new AiChatService(sessionModel as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.createSession({ _id: 'user' }, 'Hello')).resolves.toEqual({ status: 'success', data: session });
    expect(sessionModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user', title: 'Hello' }));
  });

  it('optional-auth chat creates a guest session and returns guestKey', async () => {
    const session = {
      _id: new Types.ObjectId(),
      guestKey: 'guest-key',
      title: 'New AI chat',
      recentMessages: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sessionModel = { create: jest.fn().mockResolvedValue(session) };
    const openAi = {
      chatModel: 'gpt-test',
      vectorStoreId: 'vector-store',
      requireVectorStoreId: jest.fn().mockReturnValue('vector-store'),
      createCatalogChatResponse: jest.fn().mockResolvedValue({
        output_text: JSON.stringify({
          answer: 'Here is the answer',
          clarifyingQuestion: null,
          recommendations: [],
          handoff: { show: false, label: null, url: null, reason: null },
          sessionSummary: 'summary',
          sessionTitle: 'title',
        }),
      }),
    };
    const service = new AiChatService(sessionModel as any, {} as any, {} as any, {} as any, {} as any, {} as any, openAi as any);

    await expect(service.chat({ messages: [{ role: 'user', content: 'What should I learn?' }] }, null)).resolves.toMatchObject({
      status: 'success',
      data: { guestKey: 'guest-key', answer: 'Here is the answer' },
    });
    expect(openAi.createCatalogChatResponse).toHaveBeenCalled();
    expect(session.save).toHaveBeenCalled();
  });

  it('chat rejects missing OpenAI/vector configuration before calling the provider', async () => {
    const openAi = { requireVectorStoreId: jest.fn(() => { throw new ApiException('OPENAI_VECTOR_STORE_ID is not configured', 500); }) };
    const service = new AiChatService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, openAi as any);

    await expect(service.chat({ messages: [{ role: 'user', content: 'Hi' }] }, null)).rejects.toBeInstanceOf(ApiException);
  });

  it('drops inactive or missing catalog recommendations', async () => {
    const course = { _id: objectId(), title: { en: 'Course A' }, slug: 'course-a', category: { title: { en: 'Cat' } } };
    const courseModel = {
      findOne: jest
        .fn()
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(course) }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) }) }),
    };
    const service = new AiChatService({} as any, courseModel as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(
      service.validateRecommendations([
        { type: 'course', id: course._id, reason: 'Good fit' },
        { type: 'course', id: objectId(), reason: 'Inactive' },
      ]),
    ).resolves.toHaveLength(1);
  });

  it('resets AI knowledge rag status on create and update', async () => {
    const doc = { rag: { status: 'synced' }, save: jest.fn().mockResolvedValue(undefined) };
    const knowledgeModel = {
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockResolvedValue(doc),
    };
    const service = new AiKnowledgeService(knowledgeModel as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await service.create({ title: { en: 'FAQ' } });
    await service.update(objectId(), { content: { en: 'Changed' } });

    expect(knowledgeModel.create).toHaveBeenCalledWith(expect.objectContaining({ rag: { status: 'pending' } }));
    expect(doc.rag).toMatchObject({ status: 'pending', error: '' });
    expect(doc.save).toHaveBeenCalled();
  });

  it('sync-selected writes success summary and sync log without network calls', async () => {
    const sourceId = objectId();
    const source = { _id: sourceId, status: 'active', title: { en: 'FAQ' }, content: { en: 'Content' }, rag: { status: 'pending' } };
    const knowledgeModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(source) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const log = { save: jest.fn().mockResolvedValue(undefined) };
    const syncLogModel = { create: jest.fn().mockResolvedValue(log) };
    const openAi = {
      vectorStoreId: 'vector-store',
      syncLimit: 25,
      requireVectorStoreId: jest.fn().mockReturnValue('vector-store'),
      deleteVectorStoreFile: jest.fn().mockResolvedValue(undefined),
      uploadVectorTextFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
    };
    const service = new AiKnowledgeService(knowledgeModel as any, syncLogModel as any, {} as any, {} as any, {} as any, openAi as any);

    await expect(service.syncSelected({ sourceType: 'knowledge', sourceId }, { _id: 'admin' })).resolves.toMatchObject({
      status: 'success',
      data: { summary: { total: 1, synced: 1, failed: 0 } },
    });
    expect(openAi.uploadVectorTextFile).toHaveBeenCalled();
    expect(log.save).toHaveBeenCalled();
  });

  it('sync failure marks the item failed and stores failure details in the log', async () => {
    const sourceId = objectId();
    const knowledgeModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: sourceId, status: 'active', title: { en: 'FAQ' }, rag: { status: 'pending' } }) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const log = { save: jest.fn().mockResolvedValue(undefined) };
    const syncLogModel = { create: jest.fn().mockResolvedValue(log) };
    const openAi = {
      vectorStoreId: 'vector-store',
      syncLimit: 25,
      requireVectorStoreId: jest.fn().mockReturnValue('vector-store'),
      deleteVectorStoreFile: jest.fn().mockResolvedValue(undefined),
      uploadVectorTextFile: jest.fn().mockRejectedValue(new Error('upload failed')),
    };
    const service = new AiKnowledgeService(knowledgeModel as any, syncLogModel as any, {} as any, {} as any, {} as any, openAi as any);

    await expect(service.syncSelected({ sourceType: 'knowledge', sourceId }, { _id: 'admin' })).resolves.toMatchObject({
      data: { summary: { total: 1, failed: 1 } },
    });
    expect(knowledgeModel.findByIdAndUpdate).toHaveBeenCalledWith(sourceId, { $set: { rag: expect.objectContaining({ status: 'failed', error: 'upload failed' }) } });
  });

  it('ID document upload rejects missing bearer token before touching files', async () => {
    const service = new IdentityVerificationService({} as any, {} as any, {} as any, {} as any);

    await expect(service.uploadIdDocument(undefined, {})).rejects.toThrow('You are not logged in. Please log in to get access');
  });

  it('ID verification maps duplicate extracted ID numbers to rejected', async () => {
    const userModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'other', idNumber: 'ABC123' }) }) }),
    };
    const openAi = {
      apiKey: 'test-key',
      verifyIdentityWithVision: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ verificationStatus: 'verified', isAuthentic: true, confidence: 95, extractedName: 'User A', extractedIdNumber: 'ABC123', issues: [] }) } }],
      }),
    };
    const service = new IdentityVerificationService(userModel as any, {} as any, openAi as any, {} as any);

    await expect(service.verifyUserIdentity('user', ['id.webp'], { name: 'User A' })).resolves.toMatchObject({
      updateData: { idVerification: 'rejected' },
      verificationResult: { status: 'rejected', issues: expect.arrayContaining(['ID number is already used by another account']) },
    });
  });

  it('admin manual ID action requires identity fields for verified status and sends notification', async () => {
    const userModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: 'user' }) };
    const notificationModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new IdentityVerificationService(userModel as any, notificationModel as any, {} as any, {} as any);

    await expect(service.actionOnIdDocument('user', { action: 'verified' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.actionOnIdDocument('user', { action: 'verified', idNumber: '123', name: 'Verified User' })).resolves.toMatchObject({ status: 'success' });
    expect(notificationModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user', type: 'system' }));
  });
});
