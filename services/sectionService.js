const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Lesson = require('../models/lessonModel');
const Section = require('../models/sectionModel');
const factory = require('./handllerFactory');
const Course = require('../models/courseModel');

//@desc get list of sections
//@route GET /api/v1/sections
//@access public
exports.filterSectionsByCourse = async (req, res, next) => {
  const filterObject = { course: req.params.courseId };
  req.filterObj = filterObject;
  next();
};

exports.getSections = factory.getALl(Section, 'Section', {
  path: 'course',
  select: 'title -accessibleCourses -category',
});

//@desc get specific Section by id
//@route GET /api/v1/sections/:id
//@access public
exports.getSection = factory.getOne(Section);

exports.isTheSectionInstructor = async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }
  if (!req.user.isInstructor) {
    return next(new ApiError('You are not instructor', 404));
  }
  let courseId;
  // Get course ID from section or request body
  const id = req.params.id || req.params.sectionId;
  if (id) {
    const section = await Section.findById(id);
    if (!section) {
      return next(new ApiError('Section not found', 404));
    }
    courseId = section.course;
  } else {
    courseId = req.body.course;
  }

  // Check if course exists and user is the instructor
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ApiError('Course not found', 404));
  }

  if (course.instructor.toString() !== req.user._id.toString()) {
    return next(new ApiError('You are not the instructor of this course', 404));
  }

  next();
};
//@desc create Section
//@route POST /api/v1/sections
//@access private
exports.createSection = factory.createOne(Section);

//@desc update specific Section
//@route PUT /api/v1/sections/:id
//@access private
exports.updateSection = factory.updateOne(Section);

//@desc delete Section
//@route DELETE /api/v1/sections/:id
//@access private
exports.deleteSection = asyncHandler(async (req, res, next) => {
  const lessons = await Lesson.find({ section: req.params.id });
  if (lessons.length > 0) {
    return next(new ApiError("You can't delete section that has lessons", 400));
  }
  await Section.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

//@desc update section with nested lesson management
//@route PUT /api/v1/sections/:id/with-lessons
//@access private
// exports.updateSectionWithLessons = asyncHandler(async (req, res, next) => {
//   const { lessons, ...sectionData } = req.body;

//   await mongoose.connection
//     .transaction(async (session) => {
//       // Find the section
//       const { sectionId } = sectionData;
//       if (sectionId) {
//         const section = await Section.findById(sectionId).session(session);
//       } else {
//         const section = await Section.findById(req.params.id).session(session);
//       }

//       if (!section) {
//         return next(new ApiError(`Section not found for this id ${id}`, 404));
//       }

//       // Update section data (excluding lessons array)
//       const updatedSection = await Section.findByIdAndUpdate(id, sectionData, {
//         new: true,
//         runValidators: true,
//       }).session(session);

//       // Handle lessons if provided
//       if (lessons && Array.isArray(lessons)) {
//         // Get existing lesson IDs for this section
//         const existingLessons = await Lesson.find({ section: id }).session(
//           session
//         );
//         const existingLessonIds = existingLessons.map((lesson) =>
//           lesson._id.toString()
//         );

//         // Track lessons to keep (those with _id in the request)
//         const lessonsToKeep = [];
//         const lessonsToCreate = [];
//         const lessonsToUpdate = [];

//         // Process each lesson in the request
//         lessons.forEach((lessonData) => {
//           if (lessonData._id) {
//             // Check if this lesson exists in the database
//             if (existingLessonIds.includes(lessonData._id)) {
//               // Update existing lesson
//               const { _id, ...updateData } = lessonData;
//               updateData.section = id; // Ensure section reference is correct
//               updateData.course = section.course; // Ensure course reference is correct

//               lessonsToUpdate.push({ _id, updateData });
//               lessonsToKeep.push(_id);
//             } else {
//               // Lesson ID provided but doesn't exist - treat as new lesson
//               const { _id, ...createData } = lessonData;
//               createData.section = id;
//               createData.course = section.course;

//               lessonsToCreate.push(createData);
//             }
//           } else {
//             // New lesson without _id
//             const createData = { ...lessonData };
//             createData.section = id;
//             createData.course = section.course;

//             lessonsToCreate.push(createData);
//           }
//         });

//         // Create new lessons
//         if (lessonsToCreate.length > 0) {
//           await Lesson.insertMany(lessonsToCreate, { session });
//         }

//         // Update existing lessons
//         await Promise.all(
//           lessonsToUpdate.map(({ _id, updateData }) =>
//             Lesson.findByIdAndUpdate(_id, updateData, {
//               new: true,
//               runValidators: true,
//             }).session(session)
//           )
//         );

//         // Delete lessons that exist in DB but not in request
//         const lessonsToDelete = existingLessonIds.filter(
//           (lessonId) => !lessonsToKeep.includes(lessonId)
//         );

//         if (lessonsToDelete.length > 0) {
//           await Lesson.deleteMany({
//             _id: { $in: lessonsToDelete },
//           }).session(session);
//         }
//       }

//       // Get updated section with populated lessons
//       const finalSection = await Section.findById(id)
//         .populate({
//           path: "course",
//           select: "title -accessibleCourses -category",
//         })
//         .session(session);

//       // Get all lessons for this section
//       const sectionLessons = await Lesson.find({ section: id })
//         .sort({ order: 1 })
//         .session(session);

//       res.status(200).json({
//         status: "success",
//         data: {
//           section: finalSection,
//           lessons: sectionLessons,
//         },
//       });
//     })
//     .catch((error) => {
//       // Handle any transaction-related errors
//       console.error("Transaction error:", error);
//       return next(new ApiError("Error during section update", 500));
//     });
// });
