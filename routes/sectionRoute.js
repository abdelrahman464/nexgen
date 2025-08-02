const express = require('express');

const {
  getSectionValidator,
  createSectionValidator,
  updateSectionValidator,
  deleteSectionValidator,
  getSectionCourseIdValidator,
} = require('../utils/validators/sectionValidator');
const {
  getSections,
  createSection,
  getSection,
  updateSection,
  deleteSection,
  filterSectionsByCourse,
  isTheSectionInstructor,
} = require('../services/sectionService');


const authServices = require('../services/authServices');

const router = express.Router();

router
  .route('/:courseId/course')
  .get(getSectionCourseIdValidator, filterSectionsByCourse, getSections);
router
  .route('/')
  .get(getSections)
  .post(
    authServices.protect,
    createSectionValidator,
    isTheSectionInstructor,
    createSection,
  );
router
  .route('/:id')
  .get(getSectionValidator, getSection)
  .put(
    authServices.protect,
    updateSectionValidator,
    isTheSectionInstructor,
    updateSection,
  )
  .delete(
    authServices.protect,
    deleteSectionValidator,
    isTheSectionInstructor,
    deleteSection,
  );

module.exports = router;
