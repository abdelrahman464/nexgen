const express = require("express");
const {
  getUserValidator,
  createUserValidator,
  updateUserValidator,
  deleteUserValidator,
  changeUserPasswordValidator,
  updateLoggedUserValidator,
  changeLoggedUserPasswordValidator,
  actionOnIdDocumentValidator,
} = require("../utils/validators/userValidator");
const authServices = require("../services/authServices");
const {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  updateLoggedUserPassword,
  updateLoggedUserData,
  unActiveUser,
  activeUser,
  uploadImages,
  resizeImage,
  createFilterObjToGetInstructors,
  getUserData,
  getPurchasersUsersAndNon,
  getUsersWithoutCourse,
  getUsersCourse,
  followUser,
  unFollowUser,
  getMyFollowersAndFollowing,
  deActiveNotificationBell,
  activeNotificationBell,
  actionOnIdDocument,
  uploadIdDocument,
  moveOneUserToAnother,
  getInstructorBelongings,
  getAllInstructorsWithBelongings,
} = require("../services/userService");

const router = express.Router();
//get all instructors for un authenticated users
router.get(
  "/Instructors",
  (req, res, next) => {
    req.filterObj = { isInstructor: true };
    next();
  },
  getUsers
);
router.get(
  "/adminAndInstructor",
  authServices.protect,
  createFilterObjToGetInstructors,
  getUsers
);

router.put(
  "/moveOneUserToAnother",
  authServices.protect,
  authServices.allowedTo("admin"),
  moveOneUserToAnother
);

router
  .route("/active/:id")
  .put(authServices.protect, activeUser)
  .delete(authServices.protect, unActiveUser);

router.put(
  "/changeMyPassword",
  authServices.protect,
  changeLoggedUserPasswordValidator,
  updateLoggedUserPassword
);
router.put(
  "/changeMyData",
  authServices.protect,
  uploadImages,
  resizeImage,
  updateLoggedUserValidator,
  updateLoggedUserData
);
router.put(
  "/changePassword/:id",
  authServices.protect,
  authServices.allowedTo("admin"),
  changeUserPasswordValidator,
  changeUserPassword
);

router
  .route("/")
  .get(authServices.protect, authServices.allowedTo("admin"), getUsers)
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    uploadImages,
    resizeImage,
    createUserValidator,
    createUser
  );
router
  .route("/:id")
  .get(authServices.protect, getUserValidator, getUser)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    uploadImages,
    resizeImage,
    updateUserValidator,
    updateUser
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    deleteUserValidator,
    deleteUser
  );

router.get(
  "/:id/userData",
  authServices.protect,
  authServices.allowedTo("admin"),
  getUserData
);

router.get(
  "/course/usersWithOutCourse/:courseId",
  authServices.protect,
  authServices.allowedTo("admin"),
  getUsersWithoutCourse
);
router.get(
  "/course/usersCourse/:courseId",
  authServices.protect,
  authServices.allowedTo("admin"),
  getUsersCourse
);
router.get(
  "/order/purchasersAndNon",
  authServices.protect,
  authServices.allowedTo("admin"),
  getPurchasersUsersAndNon
);

router
  .route("/follow/:id")
  .post(authServices.protect, followUser)
  .delete(authServices.protect, unFollowUser);

router
  .route("/notificationBell/:id")
  .post(authServices.protect, activeNotificationBell)
  .delete(authServices.protect, deActiveNotificationBell);

router.get(
  "/follow/followersAndFollowing",
  authServices.protect,
  getMyFollowersAndFollowing
);

router.put(
  "/idDocument/:id/action",
  authServices.protect,
  authServices.allowedTo("admin"),
  actionOnIdDocumentValidator,
  actionOnIdDocument
);

router.post("/idDocument/upload", uploadImages, resizeImage, uploadIdDocument);

router.get(
  "/instructors/withBelongings",
  authServices.protect,
  authServices.allowedTo("admin"),
  getAllInstructorsWithBelongings
);

module.exports = router;
