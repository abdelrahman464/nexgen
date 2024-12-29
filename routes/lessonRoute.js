const express = require('express');
const authServices = require('../services/authServices');
const {
  createLessonValidator,
  updateLessonValidator,
  checkCourseAccess,
  checkLessonAccess,
} = require('../utils/validators/lessonsValidator');

const { checkMongoId } = require('../utils/public/publicValidator');

const {
  getLessons,
  getCourseLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonById,
  uploadFiles,
  resizeFiles,
  setCourseIdToBody,
  getSectionLessons,
} = require('../services/lessonServices');

const router = express.Router({ mergeParams: true });
// Get Course Lessons
router.get(
  '/courseLessons/:id',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkMongoId("id"),
  checkCourseAccess,
  getCourseLessons,
);
router.get(
  '/sectionLessons/:id',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkMongoId("id"),
  checkCourseAccess,
  getSectionLessons,
);
// Get all lessons
router.get(
  '/',
  authServices.protect,
  authServices.allowedTo('admin'),
  getLessons,
);
// Get a specific lesson by ID
//only admin can get lesson by id
router.get(
  '/:id',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkMongoId("id"),
  checkLessonAccess,
  getLessonById,
);
// Create a new lesson
router.post(
  '/',
  authServices.protect,
  authServices.allowedTo('admin'),
  uploadFiles,
  resizeFiles,
  setCourseIdToBody,
  createLessonValidator,
  createLesson,
);

// Update a lesson by ID
router.put(
  '/:id',
  authServices.protect,
  authServices.allowedTo('admin'),
  uploadFiles,
  resizeFiles,
  checkMongoId("id"),
  updateLessonValidator,
  updateLesson,
);

// Delete a lesson by ID
router.delete(
  '/:id',
  authServices.protect,
  authServices.allowedTo('admin'),
  checkMongoId("id"),
  deleteLesson,
);

module.exports = router;
