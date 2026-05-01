const express = require('express');
const rateLimit = require('express-rate-limit');
const { chatWithCatalogAssistant } = require('../services/aiChatService');

const router = express.Router();

const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many AI chat requests, please try again later.',
  },
});

router.post('/', aiChatLimiter, chatWithCatalogAssistant);

module.exports = router;
