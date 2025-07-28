const express = require("express");
const contactUsService = require("../services/contactUsService");
const { protect, allowedTo } = require("../services/authServices");
const {
  validateContactUs,
} = require("../utils/validators/contactUsValidator");

const router = express.Router();

router.post(
  "/",
  validateContactUs,
  contactUsService.createContactUs
);

router.get("/", protect, allowedTo("admin"), contactUsService.getAllContactUs);

module.exports = router;
