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
});
