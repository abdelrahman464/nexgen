const express = require('express');

const {
  processPostValidator,
  createPostValidator,
  getPostValidator,
  checkCourseAuthority,
} = require('../utils/validators/postValidator');
const authServices = require('../services/authServices');
const {
  convertToArray,
  createPost,
  createFilterObjHomePosts,
  createFilterObjPackagesPosts,
  createFilterObjAllowedCoursePosts,
  getPost,
  updatePost,
  deletePost,
  uploadFiles,
  processFiles,

  getPosts,
} = require('../services/postServices');

const router = express.Router();

router
  .route('/')
  .get(authServices.protect, createFilterObjHomePosts, getPosts)
  .post(
    authServices.protect,
    authServices.allowedTo('user', 'admin'),
    uploadFiles,
    processFiles,
    convertToArray,
    createPostValidator,
    checkCourseAuthority,
    createPost,
  );
router.get(
  '/courses',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  createFilterObjAllowedCoursePosts,
  getPosts,
);
router.get(
  '/packages',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  createFilterObjPackagesPosts,
  getPosts,
);
router
  .route('/:id')
  .get(
    authServices.protect,
    authServices.allowedTo('user', 'admin'),
    getPostValidator,
    getPost,
  )
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadFiles,
    processFiles,
    processPostValidator,
    updatePost,
  )
  .delete(
    authServices.protect,
    authServices.allowedTo('admin'),
    processPostValidator,
    deletePost,
  );

module.exports = router;
