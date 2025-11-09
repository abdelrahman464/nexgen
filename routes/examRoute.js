const router = require("express").Router();
const { checkCourseAccess } = require("../utils/validators/lessonsValidator");
const { isTheExamInstructor } = require("../utils/validators/examValidator");
const { checkCourseInstructorOrAdmin } = require("../utils/validators/courseValidator");
const { isTheLessonInstructor } = require("../services/lessonServices");
const authService = require("../services/authServices");
const {
  createExam,
  deleteExam,
  uploadQuestionAndOptions,
  processQuestionImages,
  addQuestionToExam,
  updateQuestionInExam,
  removeQuestionsFromExam,
  getExams,
  getExam,
  createFilterObj,
  userScores,
  getCourseProgress,
  getLessonPerformance,
  getCoursePerformance,
  // start exams
  placementExam,
  submitCoursePlacementAnswers,
  lessonExam,
  submitLessonAnswers,
  courseExam,
  submitCourseAnswers,
  //end exams
} = require("../services/exams/examService");

const {
  checkLessonExamAccess,
} = require("../utils/validators/lessonsValidator");
// const { isInstructor } = require('../utils/public/publicValidator');

router.get(
  "/courseProgress/:courseId/:userId",
  authService.protect,
  getCourseProgress
);
router.get(
  "/getLessonPerformance/:lessonId/:userId",
  authService.protect,
  getLessonPerformance
);
router.get(
  "/getCoursePerformance/:courseId/:userId",
  authService.protect,
  getCoursePerformance
);
//------------
router
  .route("/:examId/questions/:questionId")
  .put(
    authService.protect,
    isTheExamInstructor,
    uploadQuestionAndOptions,
    processQuestionImages,
    updateQuestionInExam
  )
  .delete(authService.protect, isTheExamInstructor, removeQuestionsFromExam);

router
  .route("/userScore/:courseId/:userId")
  .get(authService.protect, authService.allowedTo("admin", "user"), userScores);

router
  .route("/courses/:courseId")
  .get(
    authService.protect,
    checkCourseInstructorOrAdmin,
    createFilterObj("course"),
    getExams
  );
router
  .route("/placements/:courseId")
  .get(
    authService.protect,
    checkCourseInstructorOrAdmin,
    createFilterObj("placement"),
    getExams
  );
router
  .route("/lessons/:lessonId")
  .get(
    authService.protect,
    isTheLessonInstructor,
    createFilterObj("lesson"),
    getExams
  );

// to create course exam or lesson exam or placement exam
router.post("/", authService.protect, isTheExamInstructor, createExam);

router.put(
  "/:examId/questions",
  authService.protect,
  isTheExamInstructor,
  uploadQuestionAndOptions,
  processQuestionImages,
  addQuestionToExam
);

router
  .route("/:id")
  .get(authService.protect, isTheExamInstructor, getExam)
  .delete(authService.protect, isTheExamInstructor, deleteExam);

/////////////////////////////////////////////////////////////////////////
//////////////////////////For Students///////////////////////////////////
//start lesson exam
router.get(
  "/lesson/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  checkLessonExamAccess,
  lessonExam
);
router.post(
  "/lesson/:id/submit",
  authService.protect,
  authService.allowedTo("user", "admin"),
  submitLessonAnswers
);
/////////////////////////////////////////////////////////////////////////
//  course exam
router.get(
  "/course/:id",
  authService.protect,
  authService.allowedTo("user", "admin"),
  checkCourseAccess,
  courseExam
);
router.post(
  "/course/:id/submit",
  authService.protect,
  authService.allowedTo("user", "admin"),
  submitCourseAnswers
);
/////////////////////////////////////////////////////////////////////////
//  placement exam
router.get("/placement/:id", authService.protect, placementExam);
router.post(
  "/placement/:id/submit",
  authService.protect,
  submitCoursePlacementAnswers
);

module.exports = router;
