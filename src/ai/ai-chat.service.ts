import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { OpenAiProviderService } from './open-ai-provider.service';
import { ApiException } from '../common/exceptions/api.exception';

const MAX_SESSION_MESSAGES = 10;
const MAX_RECOMMENDATIONS = Number(process.env.AI_CHAT_MAX_RECOMMENDATIONS) || 3;
const TELEGRAM_SUPPORT_URL = 'https://t.me/nexgensupport';

@Injectable()
export class AiChatService {
  constructor(
    @InjectModel('AiChatSession') private readonly sessionModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('UserSubscription') private readonly subscriptionModel: Model<any>,
    private readonly openAi: OpenAiProviderService,
  ) {}

  async getSessions(user: any) {
    const sessions = await this.sessionModel
      .find({ user: user._id, status: 'active' })
      .select('title summary lastMessageAt createdAt updatedAt')
      .sort({ lastMessageAt: -1 })
      .limit(30)
      .lean();
    return { status: 'success', results: sessions.length, data: sessions };
  }

  async createSession(user: any, title?: string) {
    const session = await this.sessionModel.create({
      user: user._id,
      title: this.safeTitle(title, 'New AI chat'),
      recentMessages: [],
      lastMessageAt: new Date(),
    });
    return { status: 'success', data: session };
  }

  async getSession(id: string, user: any) {
    const session = await this.sessionModel
      .findOne({ _id: id, user: user._id, status: 'active' })
      .select('title summary recentMessages lastMessageAt createdAt updatedAt');
    if (!session) throw new NotFoundException('AI chat session not found');
    return { status: 'success', data: session };
  }

  async chat(body: any, user: any, locale = 'en', guestKeyHeader?: string) {
    this.openAi.requireVectorStoreId();
    const messages = this.sanitizeMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw new BadRequestException('A user message is required');
    const latestUserMessage = [...messages].reverse().find((message: any) => message.role === 'user');
    const session = await this.findOrCreateSession(body, user, latestUserMessage, guestKeyHeader);
    const userContext = await this.buildUserContext(user, locale);
    const conversation = [
      ...(session.recentMessages || []).map((message: any) => ({ role: message.role, content: message.content })),
      latestUserMessage,
    ].slice(-MAX_SESSION_MESSAGES);
    const response = await this.openAi.createCatalogChatResponse({
      model: this.openAi.chatModel,
      instructions: this.instructions(),
      input: [
        {
          role: 'user',
          content: this.buildConversationContext({ session, userContext, conversation, latestUserMessage }),
        },
      ],
      tools: [{ type: 'file_search', vector_store_ids: [this.openAi.vectorStoreId], max_num_results: 12 }],
      tool_choice: { type: 'file_search' },
      include: ['file_search_call.results'],
      text: { format: { type: 'json_schema', name: 'ai_catalog_chat_response', strict: true, schema: this.responseSchema() } },
      max_output_tokens: 1100,
    });
    const parsed = this.parseOpenAIResponse(response);
    const recommendations = await this.validateRecommendations(parsed.recommendations, locale);
    const answer = this.appendClarifyingQuestion(this.cleanAssistantAnswer(parsed.answer), parsed.clarifyingQuestion);
    await this.updateSessionAfterReply({ session, latestUserMessage, answer, parsed });
    return {
      status: 'success',
      data: {
        chatId: session._id.toString(),
        guestKey: user ? undefined : session.guestKey,
        answer,
        clarifyingQuestion: parsed.clarifyingQuestion || null,
        recommendations,
        handoff: this.normalizeHandoff(parsed.handoff),
      },
    };
  }

  async validateRecommendations(recommendations: any[] = [], locale = 'en') {
    const valid: any[] = [];
    const seen = new Set();
    for (const recommendation of recommendations || []) {
      const key = `${recommendation.type}:${recommendation.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const item = await this.findCatalogItem(recommendation, locale);
      if (item) valid.push(item);
    }
    return valid.slice(0, MAX_RECOMMENDATIONS);
  }

  private sanitizeMessages(messages: any[]) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter((message) => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string' && message.content.trim())
      .slice(-MAX_SESSION_MESSAGES)
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 1200) }));
  }

  private async findOrCreateSession(body: any, user: any, latestUserMessage: any, guestKeyHeader?: string) {
    const chatId = body.chatId;
    if (user && chatId && Types.ObjectId.isValid(chatId)) {
      const session = await this.sessionModel.findOne({ _id: chatId, user: user._id, status: 'active' });
      if (session) return session;
    }
    if (!user && chatId) {
      if (!Types.ObjectId.isValid(chatId)) throw new BadRequestException('Invalid AI chat session id');
      const guestKey = String(body.guestKey || guestKeyHeader || '').trim();
      if (!guestKey) throw new UnauthorizedException('Guest chat key is required');
      const session = await this.sessionModel.findOne({ _id: chatId, $or: [{ user: { $exists: false } }, { user: null }], guestKey, status: 'active' });
      if (session) return session;
      throw new NotFoundException('AI chat session not found');
    }
    return this.sessionModel.create({
      user: user?._id,
      guestKey: user ? undefined : crypto.randomUUID(),
      title: this.fallbackTitle(latestUserMessage),
      recentMessages: [],
      lastMessageAt: new Date(),
    });
  }

  private async buildUserContext(user: any, locale: string) {
    if (!user) return null;
    const [orders, activeSubscriptions] = await Promise.all([
      this.orderModel.find({ user: user._id, isPaid: true }).sort({ paidAt: -1, createdAt: -1 }).limit(10).lean(),
      this.subscriptionModel.find({ user: user._id, endDate: { $gt: new Date() } }).sort({ endDate: -1 }).limit(10).lean(),
    ]);
    const ownedItems = orders
      .map((order: any) => ({ type: this.orderType(order), title: this.titleFromOwnedItem(order, locale), paidAt: order.paidAt || order.createdAt }))
      .filter((item: any) => item.title);
    return {
      name: user.name,
      joinedAt: user.createdAt,
      language: user.lang || locale,
      account: {
        active: user.active,
        emailVerified: user.emailVerified,
        idVerification: user.idVerification || 'not_set',
        isInstructor: Boolean(user.isInstructor),
        isMarketer: Boolean(user.isMarketer),
      },
      paidOrderCount: orders.length,
      ownedItems,
      activeSubscriptions: activeSubscriptions
        .map((subscription: any) => ({ title: this.localized(subscription.package?.title, locale), endsAt: subscription.endDate }))
        .filter((subscription: any) => subscription.title),
    };
  }

  private async findCatalogItem(recommendation: any, locale: string) {
    const type = this.normalizeRecommendationType(recommendation.type);
    const id = recommendation.id;
    if (!type || !id) return null;
    let item: any;
    if (type === 'course') {
      item = await this.courseModel.findOne({ _id: id, status: 'active' }).select('title slug category price priceAfterDiscount').populate({ path: 'category', select: 'title' });
    }
    if (type === 'learningPath') {
      item = await this.coursePackageModel.findOne({ _id: id, status: 'active' }).select('title slug category price priceAfterDiscount').populate({ path: 'category', select: 'title' });
    }
    if (type === 'service') {
      item = await this.packageModel.findOne({ _id: id, status: 'active', type: 'service' }).select('title slug category price priceAfterDiscount').populate({ path: 'category', select: 'title' });
    }
    if (!item || !item.slug) return null;
    return {
      id: item._id.toString(),
      type,
      title: this.localized(item.title, locale),
      slug: item.slug,
      category: this.localized(item.category?.title || item.course?.category?.title, locale),
      price: item.price,
      priceAfterDiscount: item.priceAfterDiscount,
      reason: recommendation.reason,
    };
  }

  private async updateSessionAfterReply({ session, latestUserMessage, answer, parsed }: any) {
    const now = new Date();
    session.recentMessages = [
      ...(session.recentMessages || []).map((message: any) => ({ role: message.role, content: message.content, createdAt: message.createdAt })),
      { role: 'user', content: latestUserMessage.content, createdAt: now },
      { role: 'assistant', content: answer, createdAt: now },
    ].slice(-MAX_SESSION_MESSAGES);
    session.summary = String(parsed.sessionSummary || session.summary || '').trim().slice(0, 700);
    if (!session.title || session.title === 'New AI chat') session.title = this.safeTitle(parsed.sessionTitle, latestUserMessage.content);
    session.lastMessageAt = now;
    await session.save();
  }

  private parseOpenAIResponse(response: any) {
    const text = response.output_text || response.output?.flatMap((output: any) => output.content || []).find((content: any) => content.type === 'output_text')?.text;
    if (!text) throw new ApiException('AI assistant returned an empty response', 502);
    return JSON.parse(text);
  }

  private cleanAssistantAnswer(answer: string) {
    if (!answer || typeof answer !== 'string') return '';
    return answer
      .split('\n')
      .filter((line) => !/(course\s*id|source\s*id|t\.me\/|telegram\.me\/|telegram\.org\/|^[*-]?\s*id\s*:|^[*-]?\s*[a-f0-9]{24}\b)/i.test(line.trim()))
      .join('\n')
      .replace(/\*\*/g, '')
      .replace(/__+/g, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private appendClarifyingQuestion(answer: string, clarifyingQuestion?: string) {
    const question = typeof clarifyingQuestion === 'string' ? clarifyingQuestion.trim() : '';
    if (!question || answer.includes(question)) return answer;
    return [answer, question].filter(Boolean).join('\n\n');
  }

  private normalizeHandoff(handoff: any) {
    if (!handoff?.show) return null;
    return { show: true, label: handoff.label || 'Chat with us on Telegram', url: TELEGRAM_SUPPORT_URL, reason: handoff.reason || '' };
  }

  private buildConversationContext({ session, userContext, conversation, latestUserMessage }: any) {
    return [
      `Latest user message: ${latestUserMessage?.content || ''}`,
      'Search the synced academy knowledge for this exact question first.',
      `Conversation and user context JSON: ${JSON.stringify({ session: { title: session.title, previousSummary: session.summary || '', recentMessages: conversation }, loggedInUserContext: userContext, latestUserMessage })}`,
    ].join('\n\n');
  }

  private instructions() {
    return `You are Nexgen Academy's helpful AI assistant. Use file_search knowledge for catalog, services, learning paths, FAQs, support docs, and policies. Match the user's language. Do not mention internal files, retrieval, or knowledge base. Only recommend catalog items with exact Source ID and Source Type when the user clearly asks for recommendations. Return valid JSON matching the schema.`;
  }

  private responseSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['answer', 'clarifyingQuestion', 'recommendations', 'handoff', 'sessionSummary', 'sessionTitle'],
      properties: {
        answer: { type: 'string' },
        clarifyingQuestion: { type: ['string', 'null'] },
        recommendations: {
          type: 'array',
          maxItems: MAX_RECOMMENDATIONS,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'type', 'reason'],
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['course', 'learningPath', 'service'] },
              reason: { type: 'string' },
            },
          },
        },
        handoff: {
          type: 'object',
          additionalProperties: false,
          required: ['show', 'label', 'url', 'reason'],
          properties: {
            show: { type: 'boolean' },
            label: { type: ['string', 'null'] },
            url: { type: ['string', 'null'] },
            reason: { type: ['string', 'null'] },
          },
        },
        sessionSummary: { type: 'string' },
        sessionTitle: { type: 'string' },
      },
    };
  }

  private localized(value: any, locale: string) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const language = String(locale || 'en').startsWith('ar') ? 'ar' : 'en';
    return value[language] || value.en || value.ar || value.localized || Object.values(value).find((entry) => typeof entry === 'string') || '';
  }

  private titleFromOwnedItem(order: any, locale: string) {
    if (order.course) return this.localized(order.course.title, locale);
    if (order.coursePackage) return this.localized(order.coursePackage.title, locale);
    if (order.package) return this.localized(order.package.title, locale);
    return '';
  }

  private orderType(order: any) {
    if (order.course) return 'course';
    if (order.coursePackage) return 'learningPath';
    if (order.package) return 'service';
    return 'unknown';
  }

  private normalizeRecommendationType(type: string) {
    if (type === 'course') return 'course';
    if (type === 'learningPath' || type === 'learning_path' || type === 'path') return 'learningPath';
    if (type === 'service') return 'service';
    return '';
  }

  private safeTitle(title: string | undefined, fallback: string) {
    return String(title || fallback || 'New AI chat').trim().slice(0, 60) || 'New AI chat';
  }

  private fallbackTitle(message: any) {
    return this.safeTitle(message?.content?.replace(/\s+/g, ' '), 'New AI chat');
  }
}
