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
  getTopProfilePosters,
} = require('../services/postServices');

const router = express.Router();

router.get('/topPosters', authServices.protect, getTopProfilePosters);

router
  .route('/')
  .get(authServices.protect, createFilterObjHomePosts, getPosts)
  .post(
    authServices.protect,
    uploadFiles,
    processFiles,
    convertToArray,
    createPostValidator,
    checkCourseAuthority,
    createPost,
  );
router.get(
  '/courses/:course',
  authServices.protect,
  authServices.allowedTo('user', 'admin', 'moderator'),
  createFilterObjAllowedCoursePosts,
  getPosts,
);
router.get(
  '/packages/:package',
  authServices.protect,
  authServices.allowedTo('user', 'admin', 'moderator'),
  createFilterObjPackagesPosts,
  getPosts,
);
router
  .route('/:id')
  .get(
    authServices.protect,
    authServices.allowedTo('user', 'admin', 'moderator'),
    getPostValidator,
    getPost,
  )
  .put(
    authServices.protect,
    authServices.allowedTo('admin', 'moderator'),
    uploadFiles,
    processFiles,
    processPostValidator,
    updatePost,
  )
  .delete(
    authServices.protect,
    authServices.allowedTo('admin', 'moderator'),
    processPostValidator,
    deletePost,
  );
router.get('/topPosters', authServices.protect, getTopProfilePosters);
module.exports = router;
