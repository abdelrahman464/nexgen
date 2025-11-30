const express = require("express");
const authServices = require("../services/authServices");
const {
  getCourseAnalytics,
  getInstructorAnalytics,
  createInstructorProfitsInvoice,
  setInstructorProfitsPaymentDetails,
  getTotalSalesAnalytics,
  getSalesAnalytics
} = require("../services/marketing/instructorProfitsService");

const router = express.Router();

// Protect all routes
router.use(authServices.protect);

// Get course analytics with optional date filtering
router.get(
  "/courseAnalytics/:itemId",
  authServices.allowedTo("user", "admin"),
  getCourseAnalytics
);
router.get(
  "/total/:id?",
  authServices.allowedTo("user", "admin"),
  getTotalSalesAnalytics
);

// Get instructor analytics (existing function)
router.get(
  "/instructorAnalytics/:id?",
  authServices.allowedTo("user", "admin"),
  getInstructorAnalytics
);

// Get sales analytics by item
router.get(
  "/salesAnalytics/:id?",
  authServices.allowedTo("user", "admin"),
  getSalesAnalytics
);

module.exports = router;
