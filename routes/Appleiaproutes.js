const express = require('express');
const {
  coursePurchaseApple,
  packagePurchaseApple,
  coursePackagePurchaseApple,
  appleWebhook,
  verifyPurchase,
} = require('../services/orders/Appleiapservice');
const authServices = require('../services/authServices');

const router = express.Router();

// Webhook endpoint - NO AUTH (Apple calls this directly)
// Must be BEFORE express.json() middleware or use express.raw() for this specific route
//api/v1/appleiap/webhook/apple
router.post(
  '/webhook/apple',
  express.raw({ type: 'application/json' }),
  appleWebhook,
);

// Protected routes (require authentication)
router.use(authServices.protect); // All routes below require authentication

// Course purchase
router.post('/course/:courseId/apple', coursePurchaseApple);

// Package purchase
router.post('/package/:packageId/apple', packagePurchaseApple);

// Course Package purchase
router.post(
  '/course-package/:coursePackageId/apple',
  coursePackagePurchaseApple,
);

// Verify/restore purchase
router.post('/verify-purchase', verifyPurchase);

module.exports = router;
