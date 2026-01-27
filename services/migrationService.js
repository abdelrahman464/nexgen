const Course = require('../models/courseModel');
const Lesson = require('../models/lessonModel');
const Exam = require('../models/examModel');
const Analytic = require('../models/analyticsModel');

// Flag to track if migrations have already run in this server instance
let migrationsRun = false;

/**
 * Migration 1: Patch examQuestionsNumber on courses and lessons
 * Counts questions from related exams and updates the examQuestionsNumber field
 */
const patchExamQuestionsNumber = async () => {
  try {
    console.log('[Migration] Starting examQuestionsNumber patch...');

    // Patch courses - count questions from course exams
    const courseExams = await Exam.find({ type: 'course' }).select('course questions').lean();
    
    for (const exam of courseExams) {
      if (exam.course && exam.questions) {
        await Course.updateOne(
          { _id: exam.course, examQuestionsNumber: { $in: [0, null, undefined] } },
          { $set: { examQuestionsNumber: exam.questions.length } }
        );
      }
    }
    console.log(`[Migration] Patched ${courseExams.length} course exam question counts`);

    // Patch lessons - count questions from lesson exams
    const lessonExams = await Exam.find({ type: 'lesson' }).select('lesson questions').lean();
    
    for (const exam of lessonExams) {
      if (exam.lesson && exam.questions) {
        await Lesson.updateOne(
          { _id: exam.lesson, examQuestionsNumber: { $in: [0, null, undefined] } },
          { $set: { examQuestionsNumber: exam.questions.length } }
        );
      }
    }
    console.log(`[Migration] Patched ${lessonExams.length} lesson exam question counts`);

    console.log('[Migration] examQuestionsNumber patch completed');
  } catch (error) {
    console.error('[Migration] Error in patchExamQuestionsNumber:', error.message);
  }
};

/**
 * Migration 2: Populate course id on analytics based on doc.lesson
 * For analytics that have a lesson but no course, fetch the course from the lesson
 */
const populateAnalyticsCourseId = async () => {
  try {
    console.log('[Migration] Starting analytics course population...');

    // Find analytics with lesson but without course
    const analyticsWithoutCourse = await Analytic.find({
      lesson: { $exists: true, $ne: null },
      course: { $in: [null, undefined] }
    }).select('_id lesson').lean();

    if (analyticsWithoutCourse.length === 0) {
      console.log('[Migration] No analytics need course population');
      return;
    }

    // Get unique lesson IDs
    const lessonIds = [...new Set(analyticsWithoutCourse.map(a => a.lesson.toString()))];
    
    // Fetch lessons with their course IDs (use skipPopulate to avoid nested population)
    const lessons = await Lesson.find({ _id: { $in: lessonIds } })
      .select('_id course')
      .setOptions({ skipPopulate: true })
      .lean();

    // Create a map of lesson ID to course ID
    const lessonToCourseMap = {};
    for (const lesson of lessons) {
      if (lesson.course) {
        lessonToCourseMap[lesson._id.toString()] = lesson.course;
      }
    }

    // Bulk update analytics with course IDs
    const bulkOps = analyticsWithoutCourse
      .filter(a => lessonToCourseMap[a.lesson.toString()])
      .map(analytic => ({
        updateOne: {
          filter: { _id: analytic._id },
          update: { $set: { course: lessonToCourseMap[analytic.lesson.toString()] } }
        }
      }));

    if (bulkOps.length > 0) {
      await Analytic.bulkWrite(bulkOps);
      console.log(`[Migration] Populated course for ${bulkOps.length} analytics`);
    }

    console.log('[Migration] Analytics course population completed');
  } catch (error) {
    console.error('[Migration] Error in populateAnalyticsCourseId:', error.message);
  }
};

/**
 * Run all migrations (only once per server instance)
 */
const runMigrations = async () => {
  if (migrationsRun) {
    return;
  }
  
  migrationsRun = true;
  
  // Run migrations in background (don't block the response)
  setImmediate(async () => {
    try {
      await patchExamQuestionsNumber();
      await populateAnalyticsCourseId();
      console.log('[Migration] All migrations completed successfully');
    } catch (error) {
      console.error('[Migration] Migration error:', error.message);
    }
  });
};

module.exports = {
  runMigrations,
  patchExamQuestionsNumber,
  populateAnalyticsCourseId
};

