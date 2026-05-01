const OpenAI = require('openai');
const Course = require('../models/courseModel');
const CoursePackage = require('../models/coursePackageModel');
const Package = require('../models/packageModel');
const ApiError = require('../utils/apiError');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_HISTORY_MESSAGES = 8;
const MAX_RECOMMENDATIONS = Number(process.env.AI_CHAT_MAX_RECOMMENDATIONS) || 3;

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
    .slice(-MAX_HISTORY_MESSAGES)
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
  required: ['answer', 'clarifyingQuestion', 'recommendations'],
  properties: {
    answer: {
      type: 'string',
      description:
        'A short natural-language answer only. Do not include ids, markdown tables, or recommendation cards here.',
    },
    clarifyingQuestion: {
      type: ['string', 'null'],
      description:
        'One short follow-up question when the user need is unclear. Null when no clarification is needed.',
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
            description: 'Short reason this item matches the request.',
          },
        },
      },
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
      if (/^(course|service|learning path)\s*id/i.test(trimmed)) return false;
      if (/^[*-]?\s*id\s*:/i.test(trimmed)) return false;
      if (/^[*-]?\s*[a-f0-9]{24}\b/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
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

    const instructions = `You are Nexgen Academy's helpful AI assistant. Use the attached file_search knowledge base for catalog items, services, learning paths, FAQs, support docs, and policy answers.

Behavior:
- Match the user's language and style from their latest message. Reply in Arabic for Arabic, Egyptian Arabic when they write Egyptian Arabic, English for English, and a natural mixed style if they mix languages.
- Be conversational and useful. Do not rush to recommend many items.
- If the user's intent is unclear, ask one short clarifying question and return no recommendations.
- Usually end with one useful question that helps move the conversation forward, unless the user asked for a direct action or a complete direct answer.
- Explain choices clearly in 2-5 short sentences.
- For trading/finance topics, keep replies educational and never present investment advice, guaranteed profits, or trading signals.

Grounding rules:
- Use file_search results as the only source for Nexgen catalog, courses, learning paths, services, FAQs, and support rules.
- Only claim Nexgen offers an item if a retrieved result says it exists.
- Only recommend catalog documents with Source Type course, learningPath, or service.
- Never recommend internal knowledge/FAQ documents as clickable catalog items.
- Use the exact Source ID and Source Type from retrieved results in recommendations.
- Return at most ${MAX_RECOMMENDATIONS} recommendations, and prefer one strong match over several weak matches.
- If no strong match exists, say that clearly and suggest browsing courses/services or contacting Telegram support.
- Do not put item IDs, source IDs, markdown tables, or recommendation card details inside answer.`;

    const response = await openai.responses.create({
      model: process.env.AI_CHAT_MODEL || 'gpt-5.1',
      instructions,
      input: messages,
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          max_num_results: 8,
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
      max_output_tokens: 900,
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

    return res.status(200).json({
      status: 'success',
      data: {
        answer,
        clarifyingQuestion: parsed.clarifyingQuestion || null,
        recommendations,
      },
    });
  } catch (error) {
    return next(error);
  }
};
