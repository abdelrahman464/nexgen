const express = require("express");
const authServices = require("../services/authServices");
const {
  createLessonValidator,
  updateLessonValidator,
  checkCourseAccess,
  checkLessonAccess,
} = require("../utils/validators/lessonsValidator");

const { checkMongoId } = require("../utils/public/publicValidator");

const {
  getLessons,
  getCourseLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonById,
  resizeMedia,
  uploadlessonMedia,
  setCourseIdToBody,
} = require("../services/lessonServices");

const router = express.Router({ mergeParams: true });
// Get Course Lessons
router.get(
  "/courseLessons/:id",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkMongoId,
  checkCourseAccess,
  getCourseLessons
);
// Get all lessons
router.get(
  "/",
  authServices.protect,
  authServices.allowedTo("admin"),
  getLessons
);
// Get a specific lesson by ID
//only admin can get lesson by id
router.get(
  "/:id",
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  checkMongoId,
  checkLessonAccess,
  getLessonById
);
// Create a new lesson
router.post(
  "/",
  authServices.protect,
  authServices.allowedTo("admin"),
  uploadlessonMedia,
  resizeMedia,
  setCourseIdToBody,
  createLessonValidator,
  createLesson
);

// Update a lesson by ID
router.put(
  "/:id",
  authServices.protect,
  authServices.allowedTo("admin"),
  uploadlessonMedia,
  resizeMedia,
  checkMongoId,
  updateLessonValidator,
  updateLesson
);

// Delete a lesson by ID
router.delete(
  "/:id",
  authServices.protect,
  authServices.allowedTo("admin"),
  checkMongoId,
  deleteLesson
);

module.exports = router;
