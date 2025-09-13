const sharp = require("sharp");
const fs = require("fs");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Chat = require("../models/ChatModel");
const Course = require("../models/courseModel");
const Notification = require("../models/notificationModel");
const Order = require("../models/orderModel");
const Lesson = require("../models/lessonModel");
const CourseProgress = require("../models/courseProgressModel");
const User = require("../models/userModel");
const InstructorProfits = require("../models/instructorProfitsModel");
const { getTotalPossibleGrade, getTotalGrades } = require("./exams/examUtils");
const Exam = require("../models/examModel");
const { uploadSingleFile } = require("../middlewares/uploadImageMiddleware");
const {
  createOne,
  deleteOne,
} = require("./marketing/instructorProfitsService");
const { checkIfCourseHasAllFields } = require("../helpers/courseHelper");

exports.getInstructorCourses = asyncHandler(async (req, res, next) => {
  req.filterObj = {
    instructor: req.params.id || req.user._id,
  };
  if (
    (req.user.role === "admin" || req.user.isInstructor) &&
    req.query.status
  ) {
    req.filterObj.status = req.query.status;
  } else {
    req.filterObj.status = "active";
  }
  next();
});

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

exports.createCourse = asyncHandler(async (req, res, next) => {
  if (req.body.instructorPercentage) {
    //check if the instructor has a instructorProfits
    const instructorProfits = await InstructorProfits.findOne({
      instructor: req.body.instructor,
    });
    if (!instructorProfits) {
      return next(new ApiError("Instructor has no instructorProfits", 404));
    }
  }
  const course = await Course.create(req.body);
  const { description, title } = req.body;
  //i commented this part here and execute it in updateCourse if status is active
  // if (course) {
  //   const groupCreatorId = req.user._id.toString();

  //   const groupNameAsCourse = `Group For Course: ${title.ar}`;
  //   const groupDescriptionAsCourse = `This group is for the course: ${title.ar}} - ${description.ar}`;

  //   // Create the new group chat
  //   await Chat.create({
  //     participants: [{ user: groupCreatorId, isAdmin: true }],
  //     isGroupChat: true,
  //     course: course._id,
  //     type: "course",
  //     creator: req.user._id,
  //     groupName: groupNameAsCourse,
  //     description: groupDescriptionAsCourse,
  //   });
  // }
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
  if (req.query.keyword) {
    const textPattern = new RegExp(req.query.keyword, "i");
    req.filterObj.$or = [
      { "title.ar": { $regex: textPattern } },
      { "title.en": { $regex: textPattern } },
      { "description.ar": { $regex: textPattern } },
      { "description.en": { $regex: textPattern } },
    ];
  }
  return next();
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
  if (course.certificateDescription) {
    localizedResult.translationCertificateDescription =
      course.certificateDescription;
  }

  return res.status(200).json({
    status: "success",
    data: localizedResult,
  });
});

// Update a course by ID
exports.isTheCourseInstructor = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }
  if (!req.user.isInstructor) {
    return next(new ApiError("You are not instructor", 404));
  }
  const id = req.params.id || req.params.courseId;
  const course = await Course.findById(id);
  if (!course) {
    return next(new ApiError("Course not found", 404));
  }
  if (course.instructor.toString() !== req.user._id.toString()) {
    return next(new ApiError(`You are not the instructor of this course`, 404));
  }
  next();
};
exports.updateCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "document" }), 404)
      );
    }
    if (req.body.status && req.body.status === "active") {
      //check if this course has all fields
      const missedFields = await checkIfCourseHasAllFields(course, req.body);
      if (missedFields.length > 0) {
        return next(
          new ApiError(
            `you cannot activate this Course ,Course has missing required fields: ${missedFields.join(", ")}`,
            400
          )
        );
      }
    }
    const result = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!result) {
      return next(new ApiError("Failed to update course", 400));
    }
    if (req.body.status && req.body.status === "active") {
      const groupCreatorId = req.user._id.toString();

      const groupNameAsCourse = `Group For Course: ${course.title.ar}`;
      const groupDescriptionAsCourse = `This group is for the course: ${course.title.ar}} - ${course.description.ar}`;

      // Create the new group chat
      await Chat.create({
        participants: [{ user: groupCreatorId, isAdmin: true }],
        isGroupChat: true,
        course: course._id,
        type: "course",
        creator: req.user._id,
        groupName: groupNameAsCourse,
        description: groupDescriptionAsCourse,
      });
    }
    const localizedCourse = Course.schema.methods.toJSONLocalizedOnly(
      result,
      req.locale
    );
    res
      .status(200)
      .json({ status: `updated successfully`, data: localizedCourse });
  } catch (error) {
    console.error("Error updating document:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

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

  // Fetch course details first
  const course = await Course.findById(courseId).populate("category", "title");

  if (!course) {
    return next(new ApiError(`No course found for this id ${courseId}`, 404));
  }

  // Get basic user progress data
  const usersProgressData = await CourseProgress.find({
    course: mongoose.Types.ObjectId(courseId),
  })
    .populate({
      path: "user",
      select: "_id name email profileImg",
    })
    .populate("progress.lesson", "title order")
    .sort({ createdAt: -1 });

  // Process each user to calculate percentages using the same logic as userScores
  const usersProgressAggregation = await Promise.all(
    usersProgressData.map(async (courseProgress) => {
      if (!courseProgress.user) {
        return null; // Skip if user doesn't exist
      }

      const baseURL = process.env.BASE_URL;

      // Get completed lessons (same logic as userScores)
      const completedLessons = [];
      const seenIds = new Set();

      courseProgress.progress.forEach((item) => {
        if (
          !_.isNull(item.lesson) &&
          item.status === "Completed" &&
          !seenIds.has(item.lesson._id)
        ) {
          completedLessons.push(item);
          seenIds.add(item.lesson._id);
        }
      });

      // Calculate using the same functions as userScores
      let avgLessonsExamsPercentage = 0;
      let avgCourseExamsPercentage = null;
      let finalExamPercentage = 0;

      if (completedLessons.length > 0) {
        // Fetch Possible grades for completed lessons using the same function
        const possibleLessonExamsGrade = await getTotalGrades(completedLessons);

        // Calculate total exam score user has got
        const totalExamScore =
          completedLessons.reduce((total, item) => total + item.examScore, 0) ||
          0;

        // Calculate total possible lessons exams score
        const totalPossibleLessonExamsGrade = possibleLessonExamsGrade.reduce(
          (total, item) => total + item.grade,
          0
        );

        // Calculate the percentage of completed lessons exams (same as userScores)
        avgLessonsExamsPercentage =
          totalPossibleLessonExamsGrade > 0
            ? parseFloat(
                (
                  (totalExamScore / totalPossibleLessonExamsGrade) *
                  100
                ).toFixed(2)
              )
            : 0;

        // Calculate final exam percentage and course percentage if user completed/failed the course
        if (["Completed", "failed"].includes(courseProgress.status)) {
          const finalExamScore = courseProgress.score || 0;

          // Get final exam details (same logic as userScores)
          let finalExam = {};
          if (courseProgress.modelExam) {
            finalExam = await Exam.findOne({
              course: courseProgress.course,
              model: courseProgress.modelExam,
            });
          }
          if (!finalExam) {
            finalExam = await Exam.findOne({
              course: courseProgress.course,
            });
          }

          if (finalExam && finalExam.questions) {
            const finalExamGrade = getTotalPossibleGrade(finalExam.questions);

            // Calculate the finale exam grade percentage (same as userScores)
            finalExamPercentage =
              finalExamGrade > 0
                ? parseFloat(
                    ((finalExamScore / finalExamGrade) * 100).toFixed(2)
                  )
                : 0;

            // Calculate the total percentage of the total course exams (same as userScores)
            avgCourseExamsPercentage = parseFloat(
              (
                ((totalExamScore + finalExamScore) /
                  (totalPossibleLessonExamsGrade + (finalExamGrade || 0))) *
                100
              ).toFixed(2)
            );
          }
        }
      }

      return {
        _id: courseProgress.user._id,
        name: courseProgress.user.name,
        email: courseProgress.user.email,
        profileImg: courseProgress.user.profileImg
          ? `${baseURL}/users/${courseProgress.user.profileImg}`
          : null,
        avgLessonsExamsPercentage,
        finalExamPercentage,
        avgCourseExamsPercentage,
        status: courseProgress.status,
        score: courseProgress.score,
        attemptDate: courseProgress.attemptDate,
        certificate: courseProgress.certificate?.file
          ? `${baseURL}/certificate/${courseProgress.certificate.file}`
          : null,
      };
    })
  );

  // Filter out null results and sort by avgCourseExamsPercentage
  const validUsers = usersProgressAggregation
    .filter((user) => user !== null)
    .sort((a, b) => b.avgCourseExamsPercentage - a.avgCourseExamsPercentage);

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
        usersNotCompletedCourse: {
          $sum: { $cond: [{ $eq: ["$status", "notTaken"] }, 1, 0] },
        },
        totalCertificates: {
          $sum: { $cond: ["$certificate.file", 1, 0] },
        },
      },
    },
  ]);

  return res.status(200).json({
    status: "success",
    data: {
      courseDetails: localizedCourse,
      users: validUsers,
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

exports.giveCertificate = asyncHandler(async (req, res, next) => {
  const { userId, courseId } = req.params;
  const { file } = req.body;
  const courseProgress = await CourseProgress.findOneAndUpdate(
    {
      course: courseId,
      user: userId,
    },
    { $set: { "certificate.file": file } },
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
    data: {
      file: courseProgress.certificate.file,
      course: courseProgress.course,
    },
  });
});

// Middleware to get certificate link by courseId
exports.getCertificateLink = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  // const userId = req.user._id; // Assuming user is authenticated
  const userId = "66447ad7a7957a07c0ae9e69"; // Assuming user is authenticated

  // Validate courseId
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return next(new ApiError(`Invalid course ID: ${courseId}`, 400));
  }

  // Find course progress for the user and course
  const courseProgress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
    "certificate.file": { $exists: true, $ne: null },
  });

  if (!courseProgress || !courseProgress.certificate.file) {
    return res.status(404).json({
      status: "error",
      message: "No certificate found for this user and course",
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Certificate found",
    data: {
      hasCertificate: true,
      certificateLink: courseProgress.certificate.file,
      certificateId: courseProgress.certificate._id,
    },
  });
});
