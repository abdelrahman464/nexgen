const router = require('express').Router();
const { checkCourseAccess } = require('../utils/validators/lessonsValidator');

const authService = require('../services/authServices');
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
  sendLoggedUserIdToParams,
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
} = require('../services/examService');

const {
  checkLessonExamAccess,
} = require('../utils/validators/lessonsValidator');

router.get(
  '/courseProgress/:courseId/:userId',
  authService.protect,
  getCourseProgress,
);
router.get(
  '/getLessonPerformance/:userId/:lessonId',
  authService.protect,
  getLessonPerformance,
);
router.get(
  '/getCoursePerformance/:userId/:courseId',
  authService.protect,
  getCoursePerformance,
);
//------------
router
  .route('/:examId/questions/:questionId')
  .put(
    authService.protect,
    authService.allowedTo('admin'),
    uploadQuestionAndOptions,
    processQuestionImages,
    updateQuestionInExam,
  )
  .delete(
    authService.protect,
    authService.allowedTo('admin'),
    removeQuestionsFromExam,
  );

router
  .route('/userScore/:courseId/:userId')
  .get(authService.protect, authService.allowedTo('admin', 'user'), userScores);

router
  .route('/myScore/:courseId')
  .get(
    authService.protect,
    authService.allowedTo('user', 'admin'),
    sendLoggedUserIdToParams,
    userScores,
  );

router
  .route('/courses/:courseId')
  .get(
    authService.protect,
    authService.allowedTo('admin'),
    createFilterObj('course'),
    getExams,
  );
router
  .route('/placements/:courseId')
  .get(
    authService.protect,
    authService.allowedTo('admin'),
    createFilterObj('placement'),
    getExams,
  );
router
  .route('/lessons/:lessonId')
  .get(
    authService.protect,
    authService.allowedTo('admin'),
    createFilterObj('lesson'),
    getExams,
  );

router.post(
  '/',
  authService.protect,
  authService.allowedTo('admin'),
  createExam,
);

router.put(
  '/:examId/questions',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  uploadQuestionAndOptions,
  processQuestionImages,
  addQuestionToExam,
);

router
  .route('/:id')
  .get(authService.protect, authService.allowedTo('admin'), getExam)
  .delete(authService.protect, authService.allowedTo('admin'), deleteExam);

/////////////////////////////////////////////////////////////////////////
//start lesson exam
router.get(
  '/lesson/:id',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  checkLessonExamAccess,
  lessonExam,
);
router.post(
  '/lesson/:id/submit',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  submitLessonAnswers,
);
/////////////////////////////////////////////////////////////////////////
//  course exam
router.get(
  '/course/:id',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  checkCourseAccess,
  courseExam,
);
router.post(
  '/course/:id/submit',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  submitCourseAnswers,
);
/////////////////////////////////////////////////////////////////////////
//  placement exam
router.get(
  '/placement/:id',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  placementExam,
);
router.post(
  '/placement/:id/submit',
  authService.protect,
  authService.allowedTo('user', 'admin'),
  submitCoursePlacementAnswers,
);

module.exports = router;
