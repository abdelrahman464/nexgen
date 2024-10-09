const express = require("express");

const {
  getSectionValidator,
  createSectionValidator,
  updateSectionValidator,
  deleteSectionValidator,
} = require("../utils/validators/sectionValidator");
const {
  getSections,
  createSection,
  getSection,
  updateSection,
  deleteSection,
} = require("../services/sectionService");

const authServices = require("../services/authServices");


const router = express.Router();


router
  .route("/")
  .get(getSections)
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    createSectionValidator,
    createSection
  );
router
  .route("/:id")
  .get(getSectionValidator, getSection)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    updateSectionValidator,
    updateSection
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    deleteSectionValidator,
    deleteSection
  );

module.exports = router;
