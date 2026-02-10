const router = require('express').Router();

const authService = require('../services/authServices');
const {
  uploadImages,
  resizeImages,
  createArtical,
  getAllArticals,
  getOneArtical,
  updateArtical,
  deleteArtical,
  filterInstructorArticals,
  filterActiveArticles,
} = require('../services/articalServices');

const {
  createArticalValidator,
  getOneArticalValidator,
  updateArticalValidator,
  deleteArticalValidator,
} = require('../utils/validators/articalValidator');
const {
  checkIfInstructorHasOneActiveCourse,
} = require('../utils/validators/courseValidator');

router.post(
  '/',
  authService.protect,
  checkIfInstructorHasOneActiveCourse,
  uploadImages,
  resizeImages,
  createArticalValidator,
  createArtical,
);
router.get(
  '/getAll',
  authService.protect,
  authService.checkIfUserIsAdminOrInstructor,
  filterInstructorArticals,
  getAllArticals,
);

router.get('/', filterActiveArticles, getAllArticals);

router.get('/:id', getOneArtical);

router.put(
  '/:id',
  authService.protect,
  authService.allowedTo('admin', 'moderator'),
  uploadImages,
  resizeImages,
  updateArticalValidator,
  updateArtical,
);

router.delete(
  '/:id',
  authService.protect,
  authService.allowedTo('admin', 'moderator'),
  deleteArticalValidator,
  deleteArtical,
);

module.exports = router;
