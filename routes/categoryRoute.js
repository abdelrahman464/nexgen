const express = require('express');

const {
  getCategoryValidator,
  createCategoryValidator,
  updateCategoryValidator,
} = require('../utils/validators/categoryValidator');
const {
  getCategories,
  createCategory,
  getCategory,
  updateCategory,
  uploadImage,
  resizeImage,
} = require('../services/categoryService');

const authServices = require('../services/authServices');

const courseRoute = require('./courseRoute');

const router = express.Router();

router.use('/:categoryId/courses', courseRoute);

router
  .route('/')
  .get(getCategories)
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadImage,
    resizeImage,
    createCategoryValidator,
    createCategory,
  );
router
  .route('/:id')
  .get(getCategoryValidator, getCategory)
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadImage,
    resizeImage,
    updateCategoryValidator,
    updateCategory,
  );

module.exports = router;
