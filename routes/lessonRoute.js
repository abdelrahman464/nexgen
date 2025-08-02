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
  getSectionLessonsInPublic,
  isTheLessonInstructor,
} = require('../services/lessonServices');

const router = express.Router({ mergeParams: true });
// Get Course Lessons
router.get(
  '/courseLessons/:id',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkMongoId('id'),
  checkCourseAccess,
  getCourseLessons,
);
router.get(
  '/sectionLessons/:id',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkMongoId('id'),
  checkCourseAccess,
  getSectionLessons,
);
router.get('/sectionLessons/:id/public', getSectionLessonsInPublic);
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
  checkMongoId('id'),
  checkLessonAccess,
  getLessonById,
);
// Create a new lesson
router.post(
  '/',
  authServices.protect,
  uploadFiles,
  resizeFiles,
  setCourseIdToBody,
  createLessonValidator,
  isTheLessonInstructor,
  createLesson,
);

// Update a lesson by ID
router.put(
  '/:id',
  authServices.protect,
  uploadFiles,
  resizeFiles,
  checkMongoId('id'),
  updateLessonValidator,
  isTheLessonInstructor,
  updateLesson,
);

// Delete a lesson by ID
router.delete(
  '/:id',
  authServices.protect,
  checkMongoId('id'),
  isTheLessonInstructor,
  deleteLesson,
);

module.exports = router;
