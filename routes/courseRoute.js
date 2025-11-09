const express = require("express");

const {
  checkCourseIdParamValidator,
  createCourseValidator,
  updateCourseValidator,
  // checkCourseOwnership,
  addUserToCourseValidator,
  checkCourseInstructorOrAdmin,
} = require("../utils/validators/courseValidator");
const {
  filterActiveCourses,
  convertToArray,
  createCourse,
  getAllCourses,
  getCourseById,
  // deleteCourse,
  isTheCourseInstructor,
  updateCourse,
  addUserToCourse,
  getCourseDetails,
  getCourseUsers,
  getMyCourses,
  setCategoryIdToBody,
  uploadCourseImage,
  resizeImage,
  assignInstructorPercentage,
  removeInstructorPercentage,
  uploadCertificateFile,
  storeCertificateFile,
  giveCertificate,
  getCertificate,
  getInstructorCourses,
  getCertificateLink,
} = require("../services/courseService");
const authServices = require("../services/authServices");
// nested routes
const reviewsRoute = require("./reviewRoute");
const lessonRoute = require("./lessonRoute");

const router = express.Router({ mergeParams: true });

router.use("/:courseId/reviews", reviewsRoute);
router.use("/:courseId/lessons", lessonRoute);

router.get(
  "/MyCourses/:id?", //user id
  authServices.protect,
  getMyCourses
);
// get course users
router.get("/courseDetails/:id", authServices.protect, getCourseDetails);
// router.get('/courseUsers/:id', authServices.protect, getCourseUsers);

// Create a new course
router.post(
  "/",
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  uploadCourseImage,
  resizeImage,
  convertToArray,
  setCategoryIdToBody,
  createCourseValidator,
  createCourse
);

// Get all courses
router.get(
  "/getAll",
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  (req, res, next) => {
    console.log("hey");
    if (req.user.role === "admin") {
      req.filterObj = {};
    } else if (req.user.isInstructor) {
      req.filterObj = { instructor: req.user._id };
    }
    return next();
  },
  getAllCourses
);
// Get all active courses
router.get("/", filterActiveCourses, getAllCourses);

router.get("/instructorCourses/:id?", getInstructorCourses, getAllCourses);
// Get a specific course by ID
router.get("/:id", checkCourseIdParamValidator, getCourseById);

// Update a course by ID
router.put(
  "/:id",
  authServices.protect,
  uploadCourseImage,
  isTheCourseInstructor,
  resizeImage,
  convertToArray,
  updateCourseValidator,
  updateCourse
);

// Delete a course by ID
// router.delete(
//   '/:id',
//   authServices.protect,
//   authServices.allowedTo('admin'),
//   checkCourseIdParamValidator,
//   deleteCourse,
// );

// add user to course list
router.post(
  "/addUserToCourse/:id", //course id
  authServices.protect,
  authServices.allowedTo("admin"),
  addUserToCourseValidator,
  addUserToCourse
);

router.put(
  "/assignInstructorPercentage/:id", //course id
  authServices.protect,
  authServices.allowedTo("admin"),
  assignInstructorPercentage
);

router.delete(
  "/removeInstructorPercentage/:id", //course id
  authServices.protect,
  authServices.allowedTo("admin"),
  removeInstructorPercentage
);

router
  .route("/giveCertificate/:courseId/:userId")
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    uploadCertificateFile,
    storeCertificateFile,
    giveCertificate
  );

router.get("/getCertificate/:id", getCertificate);

router.get(
  "/getCertificateLink/:courseId",
  authServices.protect,
  getCertificateLink
);

module.exports = router;
