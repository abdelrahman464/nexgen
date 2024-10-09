const router = require("express").Router();
const { checkCourseAccess } = require("../utils/validators/lessonsValidator");

const authService = require("../services/authServices");
const {
  createExam,
  deleteExam,
  lessonExam,
  CourseExam,
  placmentExam,
  submitLessonAnswers,
  submitCourseAnswers,
  submitCoursePlacmentAnswers,
  uploadQuestionAndOptions,
  processQuestionImages,
  addQuestionToExam,
  updateQuestionInExam,
  removeQuestionsFromExam,
  getExams,
  getExam,
  createFilterObjCourseExam,
  createFilterObjLessonExam,
  createFilterObjPlacementExam,
  userScores,
  sendLoggedUserIdToParams,
  getCourseProgress,
  getLessonPerformance,
  getCoursePerformance,
} = require("../services/examService");

const {
  checkLessonExamAccess,
} = require("../utils/validators/lessonsValidator");

router.get(
  "/courseProgress/:courseId/:userId",
  authService.protect,
  getCourseProgress
);
router.get(
  "/getLessonPerformance/:userId/:lessonId",
  authService.protect,
  getLessonPerformance
);
router.get(
  "/getCoursePerformance/:userId/:courseId",
  authService.protect,
  getCoursePerformance
);
//------------
router
  .route("/:examId/questions/:questionId")
  .put(
    authService.protect,
    authService.allowedTo("admin"),
    uploadQuestionAndOptions,
    processQuestionImages,
    updateQuestionInExam
  )
  .delete(
    authService.protect,
    authService.allowedTo("admin"),
    removeQuestionsFromExam
  );

router

  .route("/userScore/:courseId/:userId")
  .get(authService.protect, authService.allowedTo("admin", "user"), userScores);

router
  .route("/myScore/:courseId")
  .get(
    authService.protect,
    authService.allowedTo("user", "admin"),
    sendLoggedUserIdToParams,
    userScores
  );

router
  .route("/course/:courseId")
  .get(
    authService.protect,
    authService.allowedTo("admin"),
    createFilterObjCourseExam,
    getExams
  );
router
  .route("/coursePlacement/:courseId")
  .get(
    authService.protect,
    authService.allowedTo("admin"),
    createFilterObjPlacementExam,
    getExams
  );
router
  .route("/lesson/:lessonId")
  .get(
    authService.protect,
    authService.allowedTo("admin"),
    createFilterObjLessonExam,
    getExams
  );

router.post(
  "/",
  authService.protect,
  authService.allowedTo("admin"),
  createExam
);

router.get(
  "/lessonExam/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  checkLessonExamAccess,
  lessonExam
);
router.get(
  "/courseExam/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  checkCourseAccess,
  CourseExam
);
router.get(
  "/placementExam/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  placmentExam
);
router.put(
  "/submitLessonAnswers/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  submitLessonAnswers
);
router.put(
  "/submitCourseAnswers/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  submitCourseAnswers
);
router.put(
  "/submitCoursePlacmentAnswers/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  submitCoursePlacmentAnswers
);
router.put(
  "/:examId/questions",
  authService.protect,
  authService.allowedTo("user", "admin"),
  uploadQuestionAndOptions,
  processQuestionImages,
  addQuestionToExam
);

router
  .route("/:id")
  .get(authService.protect, authService.allowedTo("admin"), getExam)
  .delete(authService.protect, authService.allowedTo("admin"), deleteExam);

module.exports = router;
