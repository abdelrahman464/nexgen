const crypto = require('crypto');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const Course = require('../models/courseModel');
const CoursePackage = require('../models/coursePackageModel');
const Package = require('../models/packageModel');
const Order = require('../models/orderModel');
const UserSubscription = require('../models/userSubscriptionModel');
const AiChatSession = require('../models/aiChatSessionModel');
const ApiError = require('../utils/apiError');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_SESSION_MESSAGES = 10;
const MAX_RECOMMENDATIONS = Number(process.env.AI_CHAT_MAX_RECOMMENDATIONS) || 3;
const TELEGRAM_SUPPORT_URL = 'https://t.me/nexgensupport';

const getLocalizedValue = (value, locale) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const language = String(locale || 'en').startsWith('ar') ? 'ar' : 'en';
    return (
      value[language] ||
      value.en ||
      value.ar ||
      value.localized ||
      Object.values(value).find((entry) => typeof entry === 'string') ||
      ''
    );
  }
  return String(value);
};

const getCategoryTitle = (item, locale) =>
  getLocalizedValue(item.category?.title || item.course?.category?.title, locale);

const sanitizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message) =>
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim(),
    )
    .slice(-MAX_SESSION_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }));
};

const normalizeRecommendationType = (type) => {
  if (type === 'course') return 'course';
  if (type === 'learningPath' || type === 'learning_path' || type === 'path') {
    return 'learningPath';
  }
  if (type === 'service') return 'service';
  return '';
};

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'answer',
    'clarifyingQuestion',
    'recommendations',
    'handoff',
    'sessionSummary',
    'sessionTitle',
  ],
  properties: {
    answer: {
      type: 'string',
      description:
        'A concise chat reply only. Keep it to 1-3 short sentences unless the user explicitly asks for detail. Do not include ids, markdown tables, or recommendation cards here.',
    },
    clarifyingQuestion: {
      type: ['string', 'null'],
      description:
        'Exactly one short follow-up question when the next best step is to understand the user better. Null only when no clarification is needed.',
    },
    recommendations: {
      type: 'array',
      maxItems: MAX_RECOMMENDATIONS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'reason'],
        properties: {
          id: {
            type: 'string',
            description:
              'Exact Source ID from a retrieved catalog document. Do not use knowledge FAQ ids here.',
          },
          type: {
            type: 'string',
            enum: ['course', 'learningPath', 'service'],
            description:
              'Catalog source type. Use learningPath for roadmap/path/program items.',
          },
          reason: {
            type: 'string',
            description: 'One short sentence explaining why this item matches the request.',
          },
        },
      },
    },
    handoff: {
      type: 'object',
      additionalProperties: false,
      required: ['show', 'label', 'url', 'reason'],
      properties: {
        show: {
          type: 'boolean',
          description:
            'True only when the user is stuck, confused, asks for a human/support/admin/agent, or AI cannot solve confidently.',
        },
        label: {
          type: ['string', 'null'],
          description: 'Short CTA label in the user language.',
        },
        url: {
          type: ['string', 'null'],
          description: 'Telegram support URL when show is true.',
        },
        reason: {
          type: ['string', 'null'],
          description: 'Short internal reason for showing handoff.',
        },
      },
    },
    sessionSummary: {
      type: 'string',
      description:
        'Updated concise summary of the conversation and user goals for future context. Maximum 700 characters.',
    },
    sessionTitle: {
      type: 'string',
      description:
        'Short chat title based on the current conversation, maximum 60 characters.',
    },
  },
};

const parseOpenAIResponse = (response) => {
  const text =
    response.output_text ||
    response.output
      ?.flatMap((output) => output.content || [])
      .find((content) => content.type === 'output_text')?.text;

  if (!text) {
    throw new ApiError('AI assistant returned an empty response', 502);
  }

  return JSON.parse(text);
};

const cleanAssistantAnswer = (answer) => {
  if (!answer || typeof answer !== 'string') return '';

  return answer
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/course\s*id/i.test(trimmed)) return false;
      if (/source\s*id/i.test(trimmed)) return false;
      if (/t\.me\/|telegram\.me\/|telegram\.org\//i.test(trimmed)) return false;
      if (/^(course|service|learning path)\s*id/i.test(trimmed)) return false;
      if (/^[*-]?\s*id\s*:/i.test(trimmed)) return false;
      if (/^[*-]?\s*[a-f0-9]{24}\b/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/(حسب|لحد|وفقًا|وفقا) (آخر )?(المعلومات|الملفات|الداتا|البيانات) (الموجودة )?(عندي|قدامي)/gi, '')
    .replace(/in the (files|data|knowledge base|documents) (I have|available to me)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const appendClarifyingQuestion = (answer, clarifyingQuestion) => {
  const cleanQuestion =
    typeof clarifyingQuestion === 'string' ? clarifyingQuestion.trim() : '';
  if (!cleanQuestion) return answer;
  if (answer.includes(cleanQuestion)) return answer;
  return [answer, cleanQuestion].filter(Boolean).join('\n\n');
};

const findCatalogItem = async (recommendation, locale) => {
  const type = normalizeRecommendationType(recommendation.type);
  const id = recommendation.id;
  if (!type || !id) return null;

  let item;
  if (type === 'course') {
    item = await Course.findOne({ _id: id, status: 'active' })
      .select('title slug category price priceAfterDiscount')
      .populate({ path: 'category', select: 'title' });
  }
  if (type === 'learningPath') {
    item = await CoursePackage.findOne({ _id: id, status: 'active' })
      .select('title slug category price priceAfterDiscount')
      .populate({ path: 'category', select: 'title' });
  }
  if (type === 'service') {
    item = await Package.findOne({ _id: id, status: 'active', type: 'service' })
      .select('title slug category price priceAfterDiscount')
      .populate({ path: 'category', select: 'title' });
  }
  if (!item || !item.slug) return null;

  return {
    id: item._id.toString(),
    type,
    title: getLocalizedValue(item.title, locale),
    slug: item.slug,
    category: getCategoryTitle(item, locale),
    price: item.price,
    priceAfterDiscount: item.priceAfterDiscount,
    reason: recommendation.reason,
  };
};

const validateRecommendations = async (recommendations, locale) => {
  const valid = [];
  const seen = new Set();

  for (const recommendation of recommendations || []) {
    const key = `${recommendation.type}:${recommendation.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = await findCatalogItem(recommendation, locale);
    if (item) valid.push(item);
  }

  return valid.slice(0, MAX_RECOMMENDATIONS);
};

const getLatestUserMessage = (messages) =>
  [...messages].reverse().find((message) => message.role === 'user');

const isDefaultTitle = (title) => !title || title === 'New AI chat';

const safeTitle = (title, fallback) =>
  String(title || fallback || 'New AI chat').trim().slice(0, 60) ||
  'New AI chat';

const getFallbackTitle = (message) =>
  safeTitle(message?.content?.replace(/\s+/g, ' '), 'New AI chat');

const getGuestKeyFromRequest = (req) =>
  String(req.body?.guestKey || req.headers['x-ai-chat-guest-key'] || '').trim();

const findOrCreateSession = async (req, latestUserMessage) => {
  const chatId = req.body.chatId;
  const user = req.user || null;

  if (user && chatId && mongoose.Types.ObjectId.isValid(chatId)) {
    const session = await AiChatSession.findOne({
      _id: chatId,
      user: user._id,
      status: 'active',
    });
    if (session) return session;
  }

  if (!user && chatId) {
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      throw new ApiError('Invalid AI chat session id', 400);
    }

    const guestKey = getGuestKeyFromRequest(req);
    if (!guestKey) {
      throw new ApiError('Guest chat key is required', 401);
    }

    const session = await AiChatSession.findOne({
      _id: chatId,
      $or: [{ user: { $exists: false } }, { user: null }],
      guestKey,
      status: 'active',
    });
    if (session) return session;
    throw new ApiError('AI chat session not found', 404);
  }

  return AiChatSession.create({
    user: user?._id,
    guestKey: user ? undefined : crypto.randomUUID(),
    title: getFallbackTitle(latestUserMessage),
    recentMessages: [],
    lastMessageAt: new Date(),
  });
};

const getTitleFromOwnedItem = (order, locale) => {
  if (order.course) return getLocalizedValue(order.course.title, locale);
  if (order.coursePackage) return getLocalizedValue(order.coursePackage.title, locale);
  if (order.package) return getLocalizedValue(order.package.title, locale);
  return '';
};

const getOrderType = (order) => {
  if (order.course) return 'course';
  if (order.coursePackage) return 'learningPath';
  if (order.package) return 'service';
  return 'unknown';
};

const buildUserContext = async (user, locale) => {
  if (!user) return null;

  const [orders, activeSubscriptions] = await Promise.all([
    Order.find({ user: user._id, isPaid: true })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(10)
      .lean(),
    UserSubscription.find({
      user: user._id,
      endDate: { $gt: new Date() },
    })
      .sort({ endDate: -1 })
      .limit(10)
      .lean(),
  ]);

  const ownedItems = orders
    .map((order) => ({
      type: getOrderType(order),
      title: getTitleFromOwnedItem(order, locale),
      paidAt: order.paidAt || order.createdAt,
    }))
    .filter((item) => item.title);

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
      .map((subscription) => ({
        title: getLocalizedValue(subscription.package?.title, locale),
        endsAt: subscription.endDate,
      }))
      .filter((subscription) => subscription.title),
  };
};

const buildConversationContext = ({
  session,
  userContext,
  conversation,
  latestUserMessage,
}) => {
  const context = JSON.stringify({
    session: {
      title: session.title,
      previousSummary: session.summary || '',
      recentMessages: conversation,
    },
    loggedInUserContext: userContext,
    latestUserMessage,
  });
  return [
    `Latest user message: ${latestUserMessage?.content || ''}`,
    'Search the synced academy knowledge for this exact question first, especially for academy facts like founding year, registration, license, location, and official identity.',
    `Conversation and user context JSON: ${context}`,
  ].join('\n\n');
};

const normalizeHandoff = (handoff) => {
  if (!handoff?.show) return null;
  return {
    show: true,
    label: handoff.label || 'Chat with us on Telegram',
    url: TELEGRAM_SUPPORT_URL,
    reason: handoff.reason || '',
  };
};

const updateSessionAfterReply = async ({
  session,
  latestUserMessage,
  answer,
  parsed,
}) => {
  const now = new Date();
  const nextMessages = [
    ...(session.recentMessages || []).map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
    { role: 'user', content: latestUserMessage.content, createdAt: now },
    { role: 'assistant', content: answer, createdAt: now },
  ].slice(-MAX_SESSION_MESSAGES);

  session.recentMessages = nextMessages;
  session.summary = String(parsed.sessionSummary || session.summary || '')
    .trim()
    .slice(0, 700);
  if (isDefaultTitle(session.title)) {
    session.title = safeTitle(parsed.sessionTitle, latestUserMessage.content);
  }
  session.lastMessageAt = now;
  await session.save();
};

const requireLoggedUser = (req, next) => {
  if (!req.user) {
    next(new ApiError('Please login first', 401));
    return false;
  }
  return true;
};

exports.chatWithCatalogAssistant = async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return next(new ApiError('OpenAI API key is not configured', 500));
    }
    if (!process.env.OPENAI_VECTOR_STORE_ID) {
      return next(new ApiError('OPENAI_VECTOR_STORE_ID is not configured', 500));
    }

    const locale = req.locale || req.headers['accept-language'] || 'en';
    const messages = sanitizeMessages(req.body.messages);

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return next(new ApiError('A user message is required', 400));
    }

    const latestUserMessage = getLatestUserMessage(messages);
    const session = await findOrCreateSession(req, latestUserMessage);
    const userContext = await buildUserContext(req.user, locale);
    const conversation = [
      ...(session.recentMessages || []).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      latestUserMessage,
    ].slice(-MAX_SESSION_MESSAGES);

    const instructions = `You are Nexgen Academy's helpful AI assistant. Use the attached file_search knowledge base for catalog items, services, learning paths, FAQs, support docs, and policy answers.

Behavior:
- Speak as Nexgen Academy's assistant, not as an outside researcher. Use a warm brand voice such as "Nexgen Academy..." or "we/our academy" when natural.
- Never say phrases like "my files", "the files I have", "the data in front of me", "retrieved documents", "knowledge base", or "last information available to me". These are internal implementation details.
- If a fact is not confirmed in synced knowledge, say it is not confirmed in the current academy information and offer Telegram support. Do not mention files or retrieval.
- Match the user's language and style from their latest message. Reply in Arabic for Arabic, Egyptian Arabic when they write Egyptian Arabic, English for English, and a natural mixed style if they mix languages.
- Be conversational, direct, and brief. This is a chat assistant, not a blog post.
- Default reply length is 1-3 short sentences. Use longer answers only when the user explicitly asks for details, a plan, steps, or an explanation.
- Ask only one question at a time. Never ask multiple questions in one message.
- Put the next question in clarifyingQuestion whenever you need more information. Keep answer short and do not repeat the same question in answer.
- If the user's need is broad, ask the single most useful clarifying question and return no recommendations.
- Do not dump lists of courses, learning paths, or services just because the topic exists in the catalog.
- Usually end with one useful question that helps move the conversation forward, unless the user asked for a direct action or a complete direct answer.
- For broad questions about Nexgen Academy itself, such as "what is Nexgen?" or "tell me about the academy", answer generally and return no recommendations.
- Do not recommend courses, learning paths, or services unless the user shows clear learning, buying, enrollment, comparison, or recommendation intent.
- Clear recommendation intent includes asking "I want to learn X", "what course/path/service should I take?", "recommend something for X", "I don't know X", "help me start X", or asking about a specific topic that exists in the catalog.
- If the user only asks who/what Nexgen is, summarize the academy and ask what area they are interested in instead of recommending cards.
- If the user asks when Nexgen started, when it was founded, or "امتى بدأت", answer from synced academy knowledge when present.
- If the user asks whether Nexgen is licensed, registered, official, or "مترخصة/مسجلة", distinguish between registration and regulated financial licensing. If synced academy knowledge says Nexgen is registered in Palestine, say that clearly. Do not claim there is no registration just because the user used the word "licensed".
- If synced academy knowledge contains founding/registration facts, treat them as official academy information and answer directly in Nexgen's voice.
- For trading/finance topics, keep replies educational and never present investment advice, guaranteed profits, or trading signals.
- Use loggedInUserContext only to personalize account/access/subscription support. Do not mention private user details unless directly useful.
- If the user is stuck, confused, repeats that something does not work, asks for a human, support, admin, agent, or you cannot confidently solve the issue, set handoff.show to true.
- When handoff.show is true, do not write Telegram URLs in the answer text. The frontend will render the clickable Telegram card.

Consultative recommendation flow:
- Treat broad messages like "I want to learn forex", "I want to start trading", "recommend a course", "عايز اتعلم فوركس", or "بدي أتعلم" as the start of a guided conversation.
- Before recommending, qualify the user with the most important missing detail: current level, goal, time availability, budget, preferred format, or whether they want theory, practice, mentorship, or a full roadmap.
- Ask for current level first when the topic is skill-based and the user did not provide it.
- For forex/trading, first discover whether the user is brand new, knows the basics, is practicing on demo, or already trades live. Then discover their goal before recommending.
- Recommend only after the user has provided enough context to choose a good fit, or when they explicitly ask for options without more questions.
- When recommending, prefer 1 strong match. Use up to ${MAX_RECOMMENDATIONS} only if there are genuinely different good options.
- Keep recommendation reasons specific to the user's stated needs, not generic marketing copy.
- If the user answers a clarifying question, use that answer and ask the next most useful question only if it materially changes the recommendation.

Grounding rules:
- Use file_search results as the only source for Nexgen catalog, courses, learning paths, services, FAQs, and support rules.
- Give custom AI knowledge documents priority for "about Nexgen", founding, registration, policies, support, and platform facts.
- Only claim Nexgen offers an item if a retrieved result says it exists.
- Only recommend catalog documents with Source Type course, learningPath, or service.
- Never recommend internal knowledge/FAQ documents as clickable catalog items.
- Use the exact Source ID and Source Type from retrieved results in recommendations.
- Return at most ${MAX_RECOMMENDATIONS} recommendations, and prefer one strong match over several weak matches.
- When the user has not asked for a course/path/service recommendation, the recommendations array must be empty even if relevant catalog items were retrieved.
- If no strong match exists, say that clearly and suggest browsing courses/services or contacting Telegram support.
- Do not put item IDs, source IDs, markdown tables, or recommendation card details inside answer.
- Do not put raw support links in answer. Use the handoff object for Telegram support links.
- If you are asking a clarifying question, recommendations must be an empty array.

Memory rules:
- Update sessionSummary so it captures durable context: user goal, constraints, useful account/support facts, and unresolved next steps.
- Keep sessionSummary under 700 characters.
- Keep sessionTitle short and based on the user's main topic.`;

    const response = await openai.responses.create({
      model: process.env.AI_CHAT_MODEL || 'gpt-5.1',
      instructions,
      input: [
        {
          role: 'user',
          content: buildConversationContext({
            session,
            userContext,
            conversation,
            latestUserMessage,
          }),
        },
      ],
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          max_num_results: 12,
        },
      ],
      tool_choice: { type: 'file_search' },
      include: ['file_search_call.results'],
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_catalog_chat_response',
          strict: true,
          schema: responseSchema,
        },
      },
      max_output_tokens: 1100,
    });

    const parsed = parseOpenAIResponse(response);
    const recommendations = await validateRecommendations(
      parsed.recommendations,
      locale,
    );
    const answer = appendClarifyingQuestion(
      cleanAssistantAnswer(parsed.answer),
      parsed.clarifyingQuestion,
    );

    await updateSessionAfterReply({
      session,
      latestUserMessage,
      answer,
      parsed,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        chatId: session._id.toString(),
        guestKey: req.user ? undefined : session.guestKey,
        answer,
        clarifyingQuestion: parsed.clarifyingQuestion || null,
        recommendations,
        handoff: normalizeHandoff(parsed.handoff),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getAiChatSessions = async (req, res, next) => {
  if (!requireLoggedUser(req, next)) return;

  const sessions = await AiChatSession.find({
    user: req.user._id,
    status: 'active',
  })
    .select('title summary lastMessageAt createdAt updatedAt')
    .sort({ lastMessageAt: -1 })
    .limit(30)
    .lean();

  return res.status(200).json({
    status: 'success',
    results: sessions.length,
    data: sessions,
  });
};

exports.createAiChatSession = async (req, res, next) => {
  if (!requireLoggedUser(req, next)) return;

  const session = await AiChatSession.create({
    user: req.user._id,
    title: safeTitle(req.body.title, 'New AI chat'),
    recentMessages: [],
    lastMessageAt: new Date(),
  });

  return res.status(201).json({
    status: 'success',
    data: session,
  });
};

exports.getAiChatSession = async (req, res, next) => {
  if (!requireLoggedUser(req, next)) return;

  const session = await AiChatSession.findOne({
    _id: req.params.id,
    user: req.user._id,
    status: 'active',
  }).select('title summary recentMessages lastMessageAt createdAt updatedAt');

  if (!session) {
    return next(new ApiError('AI chat session not found', 404));
  }

  return res.status(200).json({
    status: 'success',
    data: session,
  });
};
