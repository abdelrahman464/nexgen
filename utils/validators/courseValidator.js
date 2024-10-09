const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Category = require("../../models/categoryModel");
const ApiError = require("../apiError");
const Course = require("../../models/courseModel");
const CourseProgress = require("../../models/courseProgressModel");

exports.createCourseValidator = [
  check("title")
    .isLength({ min: 2 })
    .withMessage("must be at least 2 chars")
    .notEmpty()
    .withMessage("Course required"),

  check("description")
    .notEmpty()
    .withMessage("Course description is required")
    .isLength({ min: 20 })
    .withMessage("Too short description")
    .isLength({ max: 2000 })
    .withMessage("Too long description"),

  check("sold")
    .optional()
    .isNumeric()
    .withMessage("Course quantity must be a number"),

  check("price")
    .notEmpty()
    .withMessage("Course price is required")
    .isNumeric()
    .withMessage("Course price must be a number")
    .isLength({ max: 32 })
    .withMessage("To long price"),

  check("needAccessibleCourse")
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

  check("image").notEmpty().withMessage("Course Image Required"),

  check("category")
    .notEmpty()
    .withMessage("Course must be belong to a category")
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
    .custom((val, { req }) =>
      Course.findById(val).then((course) => {
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

  check("title")
    .optional()
    .isLength({ min: 2 })
    .withMessage("must be at least 2 chars")
    .notEmpty()
    .withMessage("Course required"),

  check("description")
    .optional()
    .isLength({ min: 20 })
    .withMessage("Too short description")
    .isLength({ max: 2000 })
    .withMessage("Too long description"),

  check("sold")
    .optional()
    .isNumeric()
    .withMessage("Course quantity must be a number"),

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
        throw new Error("priceAfterDiscount must be lower than price");
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

exports.checkCourseAccess = async (user, courseId) => {
  const course = await Course.findById(courseId);
  if (!course) {
    return Promise.reject(new ApiError(`course Not Found`, 404));
  }
  if (!course.needAccessibleCourse) {
    return true;
  }
  //check if user take a placment test for any course have the this course id in accessibleCourses
  //1-get placment course that user is take its exam
  const userPlacmentCourse = await Course.findOne({
    _id: user.placmentExam.course,
  });

  //check if user failed in placement exam
  // if (userPlacmentCourse && user.placmentExam.status === "failed") {
  //   return Promise.reject(
  //     new ApiError(`Access Denied: You Have Failed In Placement Exam`, 403)
  //   );
  // }
  //check if that course have the course(i want to buy) id in accessibleCourses
  // if (userPlacmentCourse && user.placmentExam.status === "Completed") {
  if (userPlacmentCourse) {
    if (userPlacmentCourse.accessibleCourses.includes(courseId)) {
      return true;
    }
  }

  // get all courses that user take it and check if this course is in the accessibleCourses
  const userCourses = await CourseProgress.find({
    user: user._id,
    status: "Completed",
  });
  if (userCourses) {
    const userCoursesIds = userCourses.map(
      (courseprogress) => courseprogress.course
    );
    const userCoursesObjects = await Course.find({
      _id: { $in: userCoursesIds },
    });
    if (userCoursesObjects) {
      userCoursesObjects.forEach((userCourse) => {
        if (userCourse.accessibleCourses.includes(courseId)) {
          return true;
        }
      });
    }
  }

  // message to tell user what he can do
  if (!userPlacmentCourse || !userCourses) {
    return Promise.reject(
      new ApiError(
        `Access Denied: You may need to complete the basics or succeed in placement exam`,
        403
      )
    );
  }

  return true;
};
