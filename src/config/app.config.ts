export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 8000,
  database: {
    uri: process.env.DB_URI,
  },
  locale: {
    first: process.env.FIRST_LANGUAGE || 'ar',
    second: process.env.SECOND_LANGUAGE || 'en',
  },
  upload: {
    maxFileSize: Number(process.env.MAX_UPLOAD_FILE_SIZE) || 20 * 1024 * 1024,
  },
  jwt: {
    secret: process.env.JWT_SECRET_KEY,
    expiresIn: process.env.JWT_EXPIRE_TIME,
  },
  ai: {
    openAiApiKey: process.env.OPENAI_API_KEY,
    vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID,
    chatModel: process.env.AI_CHAT_MODEL || 'gpt-5.1',
    syncLimit: Number(process.env.AI_KNOWLEDGE_SYNC_LIMIT) || 25,
  },
});
