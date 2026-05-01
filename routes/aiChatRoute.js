const express = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('express-async-handler');
const authServices = require('../services/authServices');
const {
  chatWithCatalogAssistant,
  createAiChatSession,
  getAiChatSession,
  getAiChatSessions,
} = require('../services/aiChatService');

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

router
  .route('/sessions')
  .get(authServices.protect, asyncHandler(getAiChatSessions))
  .post(authServices.protect, asyncHandler(createAiChatSession));

router.get(
  '/sessions/:id',
  authServices.protect,
  asyncHandler(getAiChatSession),
);

router.post('/', aiChatLimiter, authServices.optionalAuth, chatWithCatalogAssistant);

module.exports = router;
