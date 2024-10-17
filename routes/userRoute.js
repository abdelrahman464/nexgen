const express = require('express');
const {
  getUserValidator,
  createUserValidator,
  updateUserValidator,
  deleteUserValidator,
  changeUserPasswordValidator,
  updateLoggedUserValidator,
  changeLoggedUserPasswordValidator,
} = require('../utils/validators/userValidator');
const authServices = require('../services/authServices');
const {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  getLoggedUserData,
  updateLoggedUserPassword,
  updateLoggedUserData,
  unActiveUser,
  activeUser,
  uploadProfileImage,
  resizeImage,
  createFilterObjToGetInstructors,
  getUserData,
  getPurchasersUsersAndNon,
  getUsersWithoutCourse,
  getUsersCourse,
} = require('../services/userService');

const router = express.Router();

router.get('/getMe', authServices.protect, getLoggedUserData, getUser);
router.get(
  '/adminAndInstructor',
  authServices.protect,
  createFilterObjToGetInstructors,
  getUsers,
);

router
  .route('/active/:id')
  .put(authServices.protect, activeUser)
  .delete(authServices.protect, unActiveUser);

router.put(
  '/changeMyPassword',
  authServices.protect,
  changeLoggedUserPasswordValidator,
  updateLoggedUserPassword,
);
router.put(
  '/changeMyData',
  authServices.protect,
  uploadProfileImage,
  resizeImage,
  updateLoggedUserValidator,
  updateLoggedUserData,
);
router.put(
  '/changePassword/:id',
  authServices.protect,
  authServices.allowedTo('admin'),
  changeUserPasswordValidator,
  changeUserPassword,
);

router
  .route('/')
  .get(authServices.protect, authServices.allowedTo('admin'), getUsers)
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadProfileImage,
    resizeImage,
    createUserValidator,
    createUser,
  );
router
  .route('/:id')
  .get(
    authServices.protect,
    authServices.allowedTo('admin'),
    getUserValidator,
    getUser,
  )
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadProfileImage,
    resizeImage,
    updateUserValidator,
    updateUser,
  )
  .delete(
    authServices.protect,
    authServices.allowedTo('admin'),
    deleteUserValidator,
    deleteUser,
  );

router.get(
  '/:id/userData',
  authServices.protect,
  authServices.allowedTo('admin'),
  getUserData,
);

router.get(
  '/course/usersWithOutCourse/:courseId',
  authServices.protect,
  authServices.allowedTo('admin'),
  getUsersWithoutCourse,
);
router.get(
  '/course/usersCourse/:courseId',
  authServices.protect,
  authServices.allowedTo('admin'),
  getUsersCourse,
);
router.get(
  '/order/purchasersAndNon',
  authServices.protect,
  authServices.allowedTo('admin'),
  getPurchasersUsersAndNon,
);

module.exports = router;
