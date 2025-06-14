const sharp = require("sharp");
const fs = require("fs");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");

const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Chat = require("../models/ChatModel");
const Course = require("../models/courseModel");
const Notification = require("../models/notificationModel");
const Order = require("../models/orderModel");
const Lesson = require("../models/lessonModel");
const CourseProgress = require("../models/courseProgressModel");
const User = require("../models/userModel");

const { uploadSingleFile } = require("../middlewares/uploadImageMiddleware");
const { createOne, deleteOne } = require("./instructorProfitsService");

//upload course image
exports.uploadCourseImage = uploadSingleFile("image");
//upload certificate file
exports.uploadCertificateFile = uploadSingleFile("file");
//image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf(".")
    ); // Extract file extension
    const newFileName = `course-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith("image/")) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/courses/${newFileName}`;

      await sharp(file.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new profile image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          "Unsupported file type. Only images are allowed for courses.",
          400
        )
      );
    }
  }
  next();
});
//store certificate file
exports.storeCertificateFile = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file && file.mimetype === "application/pdf") {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf(".")
    ); // Extract file extension
    const newFileName = `certificate-${uuidv4()}${fileExtension}`; // Generate new file name

    const filePath = `uploads/certificate/${newFileName}`;

    // Use fs module to write the PDF file
    fs.writeFile(filePath, file.buffer, (err) => {
      if (err) {
        return next(new ApiError("Error saving PDF file", 500));
      }
      // Update the req.body to include the path for the PDF file
      req.body.file = newFileName;
      next();
    });
  } else {
    return next(
      new ApiError(
        "Unsupported file type. Only PDFs are allowed for certificate.",
        400
      )
    );
  }
});

exports.convertToArray = (req, res, next) => {
  if (req.body.accessibleCourses) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.accessibleCourses)) {
      req.body.accessibleCourses = [req.body.accessibleCourses];
    }
  }
  if (req.body.highlights) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.highlights)) {
      req.body.highlights = [req.body.highlights];
    }
  }
  next();
};
// Create a new course
exports.setCategoryIdToBody = (req, res, next) => {
  // Nested route
  if (!req.body.category) req.body.category = req.params.categoryId;
  next();
};

exports.createCourse = asyncHandler(async (req, res) => {
  // const requestBody = JSON.parse(JSON.stringify(req.body));
  // console.log(requestBody);

  const course = await Course.create(req.body);
  const { description, title } = req.body;
  if (course) {
    const groupCreatorId = req.user._id.toString();

    const groupNameAsCourse = `Group For Course: ${title.ar}`;
    const groupDescriptionAsCourse = `This group is for the course: ${title.ar}} - ${description.ar}`;

    // Create the new group chat
    await Chat.create({
      participants: [{ user: groupCreatorId, isAdmin: true }],
      isGroupChat: true,
      course: course._id,
      creator: req.user._id,
      groupName: groupNameAsCourse,
      description: groupDescriptionAsCourse,
    });
  }
  res.status(201).json({ data: course });
});

exports.getMyCourses = asyncHandler(async (req, res, next) => {
  let userId;
  if (req.params.id) {
    userId = req.params.id;
  } else {
    userId = req.user._id;
  }

  // Get all course progress for the user
  const coursesProgress = await CourseProgress.find({ user: userId });

  // Get all courses the user is enrolled in
  const courses = coursesProgress.map((course) => course.course);
  const coursesDetails = await Course.find({ _id: { $in: courses } });

  // Calculate total progress for each course
  const coursesWithProgress = await Promise.all(
    coursesDetails.map(async (course) => {
      const localizedCourse = Course.schema.methods.toJSONLocalizedOnly(
        course,
        req.locale
      );

      const courseId = course._id;
      const courseProgress = await CourseProgress.findOne({
        user: userId,
        course: courseId,
      }).populate("progress.lesson", "title order");

      const allLessons = await Lesson.find(
        { course: courseId },
        "_id"
      ).populate("course", "title");

      if (!courseProgress) {
        return { ...localizedCourse, totalProgress: 0 };
      }

      const attemptedLessonIds = new Set();
      let totalExamScore = 0;
      let completedLessonsCount = 0;

      // Process completed exams
      courseProgress.progress.forEach((item) => {
        if (item.status === "Completed") {
          completedLessonsCount += 1;
          totalExamScore += item.examScore;
          if (item.lesson) attemptedLessonIds.add(item.lesson._id.toString());
          // attemptedLessonIds.add(item.lesson._id.toString());
        }
      });

      const totalLessons = allLessons.length;
      const examsCompletedPercentage =
        (completedLessonsCount / totalLessons) * 100;
      const finalExamScore = courseProgress.score || 0;
      const finalExamCompletionPercentage = finalExamScore > 0 ? 100 : 0;

      const lessonExamsWeight = 0.8;
      const finalExamWeight = 0.2;
      const totalProgress = Number(
        (
          examsCompletedPercentage * lessonExamsWeight +
          finalExamCompletionPercentage * finalExamWeight
        ).toFixed(2)
      );

      return { ...localizedCourse, totalProgress };
    })
  );

  res.status(200).json({
    status: "success",
    data: coursesWithProgress,
  });
});

exports.filterActiveCourses = (req, res, next) => {
  req.filterObj = { status: "active" };
  next();
};
// Get all courses
exports.getAllCourses = factory.getALl(Course, "Course", [
  { path: "instructor", select: "name email profileImg" },
]);

// Get a specific course by ID
// exports.getCourseById = factory.getOne(Course, "reviews", "instructor");
// Get a specific course by ID
exports.getCourseById = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .populate("reviews")
    .populate("instructor", "name email profileImg");
  if (!course) {
    return next(
      new ApiError(`No course found for this id ${req.params.id}`, 404)
    );
  }
  const localizedResult = Course.schema.methods.toJSONLocalizedOnly(
    course,
    req.locale
  );
  const { title } = course;
  localizedResult.translationTitle = title;
  if (course.description) {
    localizedResult.translationDescription = course.description;
  }
  if (course.highlights) {
    localizedResult.translationHighlights = course.highlights;
  }
  if (course.content) {
    localizedResult.translationContent = course.content;
  }
  return res.status(200).json({
    status: "success",
    data: localizedResult,
  });
});

// Update a course by ID
exports.updateCourse = factory.updateOne(Course);

// Delete a course by ID
// exports.deleteCourse = asyncHandler(async (req, res, next) => {
//   try {
//     await mongoose.connection.transaction(async (session) => {
//       // Find and delete the course
//       const course = await Course.findByIdAndDelete(req.params.id).session(
//         session
//       );

//       // Check if course exists
//       if (!course) {
//         return next(
//           new ApiError(`Course not found for this id ${req.params.id}`, 404)
//         );
//       }

//       // Delete associated lessons and reviews
//       await Promise.all([
//         Lesson.deleteMany({ course: course._id }).session(session),
//         Section.deleteMany({ course: course._id }).session(session),
//         Review.deleteMany({ course: course._id }).session(session),
//         Chat.deleteMany({ course: course._id }).session(session),
//         Notification.deleteMany({ course: course._id }).session(session),
//         await Post.updateMany(
//           { course: { $in: course._id } },
//           { $pull: { course: { $in: course._id } } }
//         ).session(session),

//         //update order description and set order course to null
//         Order.updateMany(
//           { course: course._id },
//           {
//             $set: {
//               course: null,
//               description: `course ${course.title.en} Deleted`,
//             },
//           }
//         ).session(session),
//         //delete the package and all subscription related to this package
//         Package.deleteMany({ course: course._id }).session(session),

//         CourseProgress.updateMany(
//           { course: course._id },
//           { $unset: { course: "" } }
//         ).session(session),
//       ]);
//     });

//     // Return success response
//     res.status(204).send();
//   } catch (error) {
//     // Handle any transaction-related errors

//     if (error instanceof ApiError) {
//       // Forward specific ApiError instances
//       return next(error);
//     }
//     // Handle other errors with a generic message
//     return next(new ApiError(`Error during course deletion ${error}`, 500));
//   }
// });

// Admin add user to course
exports.addUserToCourse = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError(`no user for this email ${req.body.email}`, 404));
  }
  // Check if the user is already in the course
  const order = await Order.findOne({ user: user._id, course: req.params.id });
  if (order) {
    return next(
      new ApiError(`user ${user.name} already subscribed to this course`, 404)
    );
  }

  // Create a new order
  await Order.create({
    user: user._id,
    course: req.params.id,
    totalOrderPrice: 0,
    paymentMethodType: "free",
    isPaid: true,
    paidAt: Date.now(),
  });
  //3)- Create progress for user
  await CourseProgress.create({
    user: user._id,
    course: req.params.id,
    progress: [],
  });

  // User added to the course successfully
  res.status(200).json({
    status: "success",
    message: "User added to the course",
  });
});

//@desc get course users
//@route Get courses/courseDetails/:id
//@access protected user
exports.getCourseDetails = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;

  // Validate courseId
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return next(new ApiError(`Invalid course ID: ${courseId}`, 400));
  }

  // Fetch course details and user progress in parallel
  const [course, usersProgressAggregation] = await Promise.all([
    Course.findById(courseId).populate("category", "title"),
    CourseProgress.aggregate([
      { $match: { course: mongoose.Types.ObjectId(courseId) } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "exams",
          let: { courseId: "$course", modelExam: "$modelExam" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$course", "$$courseId"] },
                    { $eq: ["$type", "course"] },
                    { $eq: ["$model", "$$modelExam"] },
                  ],
                },
              },
            },
          ],
          as: "finalExam",
        },
      },
      { $unwind: { path: "$finalExam", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          finalExamGrade: {
            $cond: [
              { $in: ["$status", ["Completed", "failed"]] },
              { $sum: "$finalExam.questions.grade" },
              0,
            ],
          },
          userTotalExamScore: {
            $sum: "$progress.examScore",
          },
        },
      },
      {
        $project: {
          _id: "$userDetails._id",
          name: "$userDetails.name",
          email: "$userDetails.email",
          profileImg: {
            $cond: [
              { $ne: ["$userDetails.profileImg", null] },
              {
                $concat: [
                  process.env.BASE_URL,
                  "/users/",
                  "$userDetails.profileImg",
                ],
              },
              null,
            ],
          },
          totalCourseExamsPercentage: {
            $cond: {
              if: {
                $eq: [
                  {
                    $add: [
                      { $sum: "$progress.possibleGrade" },
                      "$finalExamGrade",
                    ],
                  },
                  0,
                ],
              },
              then: 0,
              else: {
                $round: [
                  // Round to 2 decimal places
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $add: [
                              "$userTotalExamScore",
                              { $ifNull: ["$score", 0] },
                            ],
                          },
                          {
                            $add: [
                              { $sum: "$progress.possibleGrade" },
                              "$finalExamGrade",
                            ],
                          },
                        ],
                      },
                      100,
                    ],
                  },
                  2,
                ],
              },
            },
          },
          status: 1,
          score: 1,
          attemptDate: 1,
          certificate: 1,
        },
      },
      { $sort: { totalCourseExamsPercentage: -1 } },
    ]),
  ]);

  if (!course) {
    return next(new ApiError(`No course found for this id ${courseId}`, 404));
  }

  // Get localized course details
  const localizedCourse = Course.schema.methods.toJSONLocalizedOnly(
    course,
    req.locale
  );

  // Get overall statistics using aggregation
  const stats = await CourseProgress.aggregate([
    { $match: { course: mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        usersCompletedCourse: {
          $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
        },
        usersFailedCourse: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        usersNotTakenCourse: {
          $sum: { $cond: [{ $eq: ["$status", "notTaken"] }, 1, 0] },
        },
        totalCertificatesDeserved: {
          $sum: { $cond: ["$certificate.isDeserve", 1, 0] },
        },
        totalCertificatesTaken: {
          $sum: { $cond: ["$certificate.isTake", 1, 0] },
        },
      },
    },
  ]);

  return res.status(200).json({
    status: "success",
    data: {
      courseDetails: localizedCourse,
      users: usersProgressAggregation,
      stats: stats[0] || {
        totalUsers: 0,
        usersCompletedCourse: 0,
        usersFailedCourse: 0,
        usersNotTakenCourse: 0,
        totalCertificatesDeserved: 0,
        totalCertificatesTaken: 0,
      },
    },
  });
});

// exports.getCourseDetails = asyncHandler(async (req, res, next) => {
//   const courseId = req.params.id;

//   // Validate courseId
//   if (!mongoose.Types.ObjectId.isValid(courseId)) {
//     return next(new ApiError(`Invalid course ID: ${courseId}`, 400));
//   }

//   // Fetch course details and stats in parallel
//   const [course, stats] = await Promise.all([
//     Course.findById(courseId)
//       .populate('category', 'title')
//       .populate('instructor', 'name email profileImg'),
//     CourseProgress.aggregate([
//       { $match: { course: mongoose.Types.ObjectId(courseId) } },
//       {
//         $group: {
//           _id: null,
//           totalUsers: { $sum: 1 },
//           usersCompletedCourse: {
//             $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
//           },
//           usersFailedCourse: {
//             $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
//           },
//           usersNotTakenCourse: {
//             $sum: { $cond: [{ $eq: ['$status', 'notTaken'] }, 1, 0] },
//           },
//           totalCertificatesDeserved: {
//             $sum: { $cond: ['$certificate.isDeserve', 1, 0] },
//           },
//           totalCertificatesTaken: {
//             $sum: { $cond: ['$certificate.isTake', 1, 0] },
//           },
//         },
//       },
//     ]),
//   ]);

//   if (!course) {
//     return next(new ApiError(`No course found for this id ${courseId}`, 404));
//   }

//   // Get localized course details
//   const localizedCourse = Course.schema.methods.toJSONLocalizedOnly(
//     course,
//     req.locale,
//   );

//   return res.status(200).json({
//     status: 'success',
//     data: {
//       courseDetails: localizedCourse,
//       stats: stats[0] || {
//         totalUsers: 0,
//         usersCompletedCourse: 0,
//         usersFailedCourse: 0,
//         usersNotTakenCourse: 0,
//         totalCertificatesDeserved: 0,
//         totalCertificatesTaken: 0,
//       },
//     },
//   });
// });

// exports.getCourseUsers = asyncHandler(async (req, res, next) => {
//   const courseId = req.params.id;
//   const limit = req.query.limit || 3;

//   if (!mongoose.Types.ObjectId.isValid(courseId)) {
//     return next(new ApiError(`Invalid course ID: ${courseId}`, 400));
//   }

//   const pipeline = [
//     {
//       $match: {
//         course: mongoose.Types.ObjectId(courseId),
//         status: 'Completed',
//       },
//     },
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'user',
//         foreignField: '_id',
//         as: 'userDetails',
//       },
//     },
//     { $unwind: '$userDetails' },
//     // Get lesson details with their exams
//     {
//       $lookup: {
//         from: 'lessons',
//         let: { courseId: '$course' },
//         pipeline: [
//           {
//             $match: {
//               $expr: { $eq: ['$course', '$$courseId'] }
//             }
//           }
//         ],
//         as: 'allLessons'
//       }
//     },
//     {
//       $lookup: {
//         from: 'lessons',
//         let: { progressArray: '$progress' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $in: ['$_id', {
//                   $map: {
//                     input: '$$progressArray',
//                     as: 'prog',
//                     in: '$$prog.lesson'
//                   }
//                 }]
//               }
//             }
//           },
//           {
//             $lookup: {
//               from: 'exams',
//               localField: '_id',
//               foreignField: 'lesson',
//               as: 'lessonExam'
//             }
//           }
//         ],
//         as: 'lessonDetails'
//       }
//     },
//     // Get final exam
//     {
//       $lookup: {
//         from: 'exams',
//         let: { courseId: '$course', modelExam: '$modelExam' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$course', '$$courseId'] },
//                   {
//                     $or: [
//                       { $eq: ['$model', '$$modelExam'] },
//                       { $eq: ['$$modelExam', null] }
//                     ]
//                   }
//                 ]
//               }
//             }
//           }
//         ],
//         as: 'finalExam'
//       }
//     },
//     { $unwind: { path: '$finalExam', preserveNullAndEmptyArrays: true } },
//     // Calculate scores and grades
//     {
//       $addFields: {
//         completedLessons: {
//           $filter: {
//             input: '$progress',
//             as: 'prog',
//             cond: { $eq: ['$$prog.status', 'Completed'] }
//           }
//         },
//         finalExamScore: { $ifNull: ['$score', 0] },
//         totalLessons: { $size: '$allLessons' }
//       }
//     },
//     {
//       $addFields: {
//         // Total exam score from completed lessons
//         totalExamScore: {
//           $sum: {
//             $map: {
//               input: '$completedLessons',
//               as: 'prog',
//               in: { $ifNull: ['$$prog.examScore', 0] }
//             }
//           }
//         },
//         // Calculate total possible lesson grades
//         totalPossibleLessonGrade: {
//           $reduce: {
//             input: '$lessonDetails',
//             initialValue: 0,
//             in: {
//               $add: [
//                 '$$value',
//                 {
//                   $sum: {
//                     $map: {
//                       input: { $ifNull: [{ $arrayElemAt: ['$$this.lessonExam.questions', 0] }, []] },
//                       as: 'question',
//                       in: { $ifNull: ['$$question.grade', 0] }
//                     }
//                   }
//                 }
//               ]
//             }
//           }
//         },
//         // Calculate final exam possible grade
//         finalExamGrade: {
//           $sum: {
//             $map: {
//               input: { $ifNull: ['$finalExam.questions', []] },
//               as: 'question',
//               in: { $ifNull: ['$$question.grade', 0] }
//             }
//           }
//         }
//       }
//     },
//     {
//       $addFields: {
//         completedLessonsCount: { $size: '$completedLessons' }
//       }
//     },
//     {
//       $project: {
//         _id: '$userDetails._id',
//         name: '$userDetails.name',
//         email: '$userDetails.email',
//         profileImg: {
//           $cond: [
//             { $ne: ['$userDetails.profileImg', null] },
//             {
//               $concat: [
//                 process.env.BASE_URL,
//                 '/users/',
//                 '$userDetails.profileImg',
//               ],
//             },
//             null,
//           ],
//         },
//         totalCourseExamsPercentage: {
//           $let: {
//             vars: {
//               totalEarnedScore: { $add: ['$totalExamScore', '$finalExamScore'] },
//               totalPossibleGrade: { $add: ['$totalPossibleLessonGrade', { $ifNull: ['$finalExamGrade', 0] }] }
//             },
//             in: {
//               $cond: {
//                 if: { $eq: ['$$totalPossibleGrade', 0] },
//                 then: 0,
//                 else: {
//                   $min: [
//                     100,
//                     {
//                       $multiply: [
//                         { $divide: ['$$totalEarnedScore', '$$totalPossibleGrade'] },
//                         100
//                       ]
//                     }
//                   ]
//                 }
//               }
//             }
//           }
//         },
//         status: 1,
//         certificate: {
//           isDeserve: { $ifNull: ['$certificate.isDeserve', false] },
//           isTake: { $ifNull: ['$certificate.isTake', false] },
//           file: {
//             $cond: [
//               { $ne: ['$certificate.file', null] },
//               {
//                 $concat: [
//                   process.env.BASE_URL,
//                   '/certificate/',
//                   '$certificate.file',
//                 ],
//               },
//               null,
//             ],
//           },
//         },
//       },
//     },
//     {
//       $addFields: {
//         totalCourseExamsPercentage: {
//           $round: ['$totalCourseExamsPercentage', 2],
//         },
//       },
//     },
//     { $sort: { totalCourseExamsPercentage: -1 } },
//     { $limit: Number(limit) },
//   ];

//   const users = await CourseProgress.aggregate(pipeline);

//   return res.status(200).json({
//     status: 'success',
//     results: users.length,
//     data: users,
//   });
// });

exports.giveCertificate = asyncHandler(async (req, res, next) => {
  const { userId, courseId } = req.params;
  const { file } = req.body;
  const courseProgress = await CourseProgress.findOneAndUpdate(
    {
      course: courseId,
      user: userId,
      "certificate.isDeserve": true,
    },
    { $set: { "certificate.isTake": true, "certificate.file": file } },
    { new: true }
  );
  if (!courseProgress) {
    return next(
      new ApiError(
        `No course progress found for this user ${userId} and course ${courseId} or user does not deserve a certificate`,
        404
      )
    );
  }
  //send notification to user
  await Notification.create({
    user: userId,
    message: {
      en: "You have received a certificate",
      ar: "لقد تلقيت شهادة",
    },
    file,
    type: "certificate",
    course: courseId,
  });

  return res.status(200).json({
    status: "success",
    msg: "Certificate given successfully",
  });
});

////NEW
exports.assignInstructorPercentage = asyncHandler(async (req, res, next) => {
  //-----------<data gathering>-------------------
  const { instructorPercentage } = req.body;
  const { id } = req.params; //course id
  //-----------</data gathering>-------------------

  //-----------<I/O>-------------------
  // Find the course and update the instructor percentage
  const course = await Course.findById(id);
  //-----------</I/O>-------------------

  //---------- <Validation>---------------------------
  // Check if course exists
  if (!course) {
    return next(new ApiError(`No course found for this id ${id}`, 404));
  }
  // Check if course has an instructor percentage
  if (course.instructorPercentage) {
    return next(
      new ApiError(
        `Instructor percentage already assigned for this course`,
        404
      )
    );
  }
  // Check if course has an instructor
  if (!course.instructor) {
    return next(new ApiError(`No instructor found for this course`, 404));
  }
  //---------- </Validation>---------------------------

  //-----------------<Business Logic>-------------------
  course.instructorPercentage = instructorPercentage;
  const result = await createOne(course.instructor);
  if (!result) {
    return next(
      new ApiError(`Error while creating instructor profit object`, 500)
    );
  }
  await course.save();
  //-----------------</Business Logic>-------------------

  //---> <Response>-------------------
  return res.status(200).json({
    status: "success",
    msg: "Instructor percentage assigned successfully",
  });
});

//---------
exports.removeInstructorPercentage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  // Find the course and update the instructor percentage
  const course = await Course.findById(id);
  // Check if course exists
  if (!course) {
    return next(new ApiError(`No course found for this id ${id}`, 404));
  }
  // Check if course has an instructor
  if (!course.instructorPercentage) {
    return next(
      new ApiError(`No instructorPercentage found for this course`, 404)
    );
  }
  // Remove the instructor percentage
  course.instructorPercentage = null;
  // Delete the instructor profit object
  await deleteOne(course.instructor);
  // Save the course
  await course.save();
  // Return success response
  return res.status(200).json({
    status: "success",
    msg: "Instructor percentage removed successfully",
  });
});
//-------------------------
// exports.migrationTask = async (req, res, next) => {
//   const docs = await CourseProgress.find({ progress: { $ne: [] } }).lean();
//   let flag = false;
//   docs.map(async (doc) => {
//     doc.progress.map(async (item) => {
//       if ("passAnalytics" in item) {
//         if (item.passAnalytics === false) {
//           item.passAnalytics = true;
//           flag = true;
//         } else if (_.isNull(item.passAnalytics)) {
//           delete item.passAnalytics;
//           flag = true;
//         }
//       }
//     });
//     if (flag) await CourseProgress.updateOne({ _id: doc._id }, doc);
//     flag = false;
//   });
//   res.json({ status: "done" });
// };

// get certificate by certificate._id
exports.getCertificate = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const courseProgress = await CourseProgress.findOne({
    "certificate._id": id,
  });
  if (!courseProgress) {
    return next(new ApiError("No Certificate found", 404));
  }
  return res.status(200).json({
    status: "success",
    data: courseProgress.certificate.file,
  });
});
