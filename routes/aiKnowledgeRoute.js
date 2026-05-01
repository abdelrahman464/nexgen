const express = require('express');
const authServices = require('../services/authServices');
const aiKnowledgeService = require('../services/aiKnowledgeService');

const router = express.Router();

router.use(authServices.protect, authServices.allowedTo('admin'));

router.get('/sync-status', aiKnowledgeService.getSyncStatus);
router.post('/sync-selected', aiKnowledgeService.syncSelected);
router.post('/sync-pending', aiKnowledgeService.syncPending);
router.post('/retry-failed', aiKnowledgeService.retryFailed);
router.post('/full-rebuild', aiKnowledgeService.fullRebuild);

router
  .route('/')
  .get(aiKnowledgeService.getAiKnowledge)
  .post(aiKnowledgeService.createAiKnowledge);

router
  .route('/:id')
  .get(aiKnowledgeService.getAiKnowledgeById)
  .put(aiKnowledgeService.updateAiKnowledge)
  .delete(aiKnowledgeService.deleteAiKnowledge);

module.exports = router;
