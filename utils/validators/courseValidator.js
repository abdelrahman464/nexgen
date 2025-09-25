const { body, check } = require("express-validator");
const slugify = require("slugify");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Category = require("../../models/categoryModel");
const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
const Section = require("../../models/sectionModel");
const CourseProgress = require("../../models/courseProgressModel");
const User = require("../../models/userModel");

exports.createCourseValidator = [
  body("title").optional().isObject().withMessage("Title must be an object."),

  body("title.en")
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`)
    .custom((val, { req }) => {
      req.body.slug = slugify(val);
      return true;
    }),

  body("title.ar")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description")
    .optional()
    .isObject()
    .withMessage("description must be an object."),

  body("description.en")
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body("description.ar")
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body("highlights")
    .optional()
    .isArray()
    .withMessage("highlights must be an array"),
  body("highlights.*")
    .optional()
    .isObject()
    .withMessage("highlight must be an object"),
  body("highlights.*.en")
    .optional()
    .isString()
    .withMessage(`en highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en highlight must be at least 3 chars`),
  body("highlights.*.ar")
    .optional()
    .isString()
    .withMessage(`ar highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar highlight must be at least 3 chars`),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Course price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("needAccessibleCourse")
    .optional()
    .isBoolean()
    .withMessage("needAccessibleCourse must be a boolean"),
  check("accessibleCourses")
    .optional()
    .isArray()
    .withMessage("accessibleCourses must be an array of course ids")
    .custom((coursesIds) => {
      if (coursesIds.length > 0) {
        coursesIds.forEach((courseId) => {
          if (!Course.findById(courseId)) {
            return Promise.reject(
              new ApiError(`Course Not Found ${courseId}`, 404)
            );
          }
        });
      }
      return true;
    }),
  // check('rating')
  //   .notEmpty()
  //   .withMessage('Course rating is required')
  //   .isNumeric()
  //   .withMessage('Course rating must be a number')
  //   .isIn([1, 2, 3, 4, 5])
  //   .withMessage('Course rating must be between 1 and 5'),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("Course priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new Error("priceAfterDiscount must be lower than price");
      }
      return true;
    }),

  check("category")
    .optional()
    .isMongoId()
    .withMessage("Invalid ID format")
    // before i add product to category i must check if category is in database
    .custom((categoryId) =>
      Category.findById(categoryId).then((category) => {
        if (!category) {
          return Promise.reject(new ApiError(`Category Not Found`, 404));
        }
      })
    ),

  check("instructor")
    .optional()
    .isMongoId()
    .withMessage("Invalid instructor ID format")
    // check if instructor exists and is actually an instructor
    .custom((instructorId) =>
      User.findById(instructorId).then((user) => {
        if (!user) {
          return Promise.reject(new ApiError(`Instructor not found`, 404));
        }
        if (!user.isInstructor && user.role !== "admin") {
          return Promise.reject(new ApiError(`User is not an instructor`, 400));
        }
      })
    ),
  check("instructorPercentage")
    .optional()
    .isNumeric()
    .withMessage("Instructor percentage must be a number")
    .isLength({ min: 1 })
    .withMessage("Instructor percentage must be above or equal 1.0")
    .isLength({ max: 70 })
    .withMessage("Instructor percentage must be below or equal 70.0"),

  check("ratingsAverage")
    .optional()
    .isNumeric()
    .withMessage("ratingsAverage must be a number")
    .isLength({ min: 1 })
    .withMessage("Rating must be above or equal 1.0")
    .isLength({ max: 5 })
    .withMessage("Rating must be below or equal 5.0"),

  check("ratingsQuantity")
    .optional()
    .isNumeric()
    .withMessage("ratingsQuantity must be a number"),

  //catch error and return it as a response
  validatorMiddleware,
];

exports.updateCourseValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((val) =>
      Course.findById(val).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`Course not found`, 404));
        }
      })
    ),

  body("title").optional().isObject().withMessage("Title must be an object."),

  body("title.en")
    .optional()
    .isString()
    .withMessage(`en title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en title must be at least 3 chars`),

  body("title.ar")
    .optional()
    .isString()
    .withMessage(`ar title must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar title must be at least 3 chars`),

  body("description")
    .optional()
    .isObject()
    .withMessage("description must be an object."),

  body("description.en")
    .optional()
    .isString()
    .withMessage(`en description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`en description must at least 10 chars`),

  body("description.ar")
    .optional()
    .isString()
    .withMessage(`ar description must be a string.`)
    .isLength({ min: 10 })
    .withMessage(`ar description must at least 10 chars`),

  body("highlights")
    .optional()
    .isArray()
    .withMessage("highlights must be an array"),
  body("highlights.*")
    .optional()
    .isObject()
    .withMessage("highlight must be an object"),
  body("highlights.*.en")
    .optional()
    .isString()
    .withMessage(`en highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`en highlight must be at least 3 chars`),
  body("highlights.*.ar")
    .optional()
    .isString()
    .withMessage(`ar highlight must be a string.`)
    .isLength({ min: 3 })
    .withMessage(`ar highlight must be at least 3 chars`),

  check("coursePercentage")
    .optional()
    .isNumeric()
    .withMessage("Course percentage must be a number"),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Course price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("priceAfterDiscount")
    .optional()
    .isNumeric()
    .withMessage("Course priceAfterDiscount must be a number")
    .toFloat()
    .custom((value, { req }) => {
      if (req.body.price <= value) {
        throw new ApiError("priceAfterDiscount must be lower than price", 400);
      }
      return true;
    }),

  check("image").optional().notEmpty().withMessage("Course Image Required"),

  check("category")
    .optional()
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((categoryId) =>
      Category.findById(categoryId).then((cateogry) => {
        if (!cateogry) {
          return Promise.reject(new ApiError(`Category Not Found`, 404));
        }
      })
    ),

  check("instructor")
    .optional()
    .isMongoId()
    .withMessage("Invalid instructor ID format")
    // check if instructor exists and is actually an instructor
    .custom((instructorId) =>
      User.findById(instructorId).then((user) => {
        if (!user) {
          return Promise.reject(new ApiError(`Instructor not found`, 404));
        }
        if (!user.isInstructor && user.role !== "admin") {
          return Promise.reject(new ApiError(`User is not an instructor`, 400));
        }
      })
    ),

  check("ratingsAverage")
    .optional()
    .isNumeric()
    .withMessage("ratingsAverage must be a number")
    .isLength({ min: 1 })
    .withMessage("Rating must be above or equal 1.0")
    .isLength({ max: 5 })
    .withMessage("Rating must be below or equal 5.0"),

  check("ratingsQuantity")
    .optional()
    .isNumeric()
    .withMessage("ratingsQuantity must be a number"),

  validatorMiddleware,
];

exports.checkCourseIdParamValidator = [
  check("id").isMongoId().withMessage("Invalid ID format"),
  validatorMiddleware,
];

exports.getRelatedCoursesValidator = [
  check("catId")
    .isMongoId()
    .withMessage("invalid mongo id ")

    .custom((courseId) =>
      Category.findById(courseId).then((category) => {
        if (!category) {
          return Promise.reject(new ApiError(`category Not Found`, 404));
        }
      })
    ),
  validatorMiddleware,
];

exports.addUserToCourseValidator = [
  check("id")
    .isMongoId()
    .withMessage("invalid mongo id ")
    .custom((courseId) =>
      Course.findById(courseId).then((course) => {
        if (!course) {
          return Promise.reject(new ApiError(`course Not Found`, 404));
        }
      })
    ),
  check("email")
    .notEmpty()
    .withMessage("Email required")
    .isEmail()
    .withMessage("Invalid email address"),
  validatorMiddleware,
];

exports.checkCourseOwnership = [
  check("id")
    .isMongoId()
    .withMessage("Invalid ID format")
    .custom((val, { req }) =>
      Course.findById(val).then((course) => {
        if (req.user.role === "admin") return true;
        if (!course) {
          return Promise.reject(new ApiError(`Course not found`, 404));
        }
        if (req.user.role !== "admin") {
          return Promise.reject(
            new ApiError(`Your are not allowed to perform this action`, 403)
          );
        }
      })
    ),
  validatorMiddleware,
];
function hasAccessibleCourse(accessibleCourses, userCoursesIds) {
  return userCoursesIds.some((userCourseId) =>
    accessibleCourses.some((accessibleCourseId) =>
      accessibleCourseId.equals(userCourseId)
    )
  );
}

exports.checkCourseAccess = async (user, courseId) => {
  const course = await Course.findById(courseId).select(
    "needAccessibleCourse accessibleCourses"
  );
  if (!course) {
    return Promise.reject(new ApiError(`course Not Found`, 404));
  }
  if (!course.needAccessibleCourse || course.accessibleCourses.length === 0) {
    return true;
  }
  //check if user take a placement test for any course have the this course id in accessibleCourses
  //1-get placement course that user is take its exam
  const userPlacementCourse = await Course.findOne({
    _id: user.placementExam.course,
  });

  //check if user failed in placement exam
  // if (userPlacementCourse && user.placementExam.status === "failed") {
  //   return Promise.reject(
  //     new ApiError(`Access Denied: You Have Failed In Placement Exam`, 403)
  //   );
  // }
  //check if that course have the course(i want to buy) id in accessibleCourses
  // if (userPlacementCourse && user.placementExam.status === "Completed") {
  if (userPlacementCourse) {
    if (userPlacementCourse.accessibleCourses.includes(courseId)) {
      return true;
    }
  }

  // get all courses that user take it and check if this course is in the accessibleCourses
  const userCourses = await CourseProgress.find({
    user: user._id,
    status: "Completed",
  });
  if (userCourses.length > 0) {
    const userCoursesIds = userCourses.map((docs) => docs.course);

    const flag = hasAccessibleCourse(course.accessibleCourses, userCoursesIds);

    if (flag) {
      return true;
    }
  }

  // message to tell user what he can do
  if (!userPlacementCourse || !userCourses) {
    return Promise.reject(
      new ApiError(
        `Access Denied: You may need to complete the basics or succeed in placement exam`,
        403
      )
    );
  }

  return true;
};

// * Check if current user is admin or course instructor
exports.checkCourseInstructorOrAdmin = async (req, res, next) => {
  try {
    const { id: courseId } = req.params;
    console.log("courseId", req.user.role);
    // If user is admin, allow access
    if (req.user.role === "admin") {
      return next();
    }
    console.log("not admin");

    // Find the course and check if user is the instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "failed",
        error: "Course not found",
      });
    }
    if (course.status !== "active") {
      return res.status(403).json({
        status: "failed",
        error: "Course is not active",
      });
    }

    // Check if current user is the instructor of this course
    if (course.instructor.toString() === req.user._id.toString()) {
      return next();
    }

    // User is neither admin nor instructor
    return res.status(403).json({
      status: "failed",
      error: "You are not authorized ",
    });
  } catch (err) {
    return res.status(500).json({ status: "failed", error: err.message });
  }
};
