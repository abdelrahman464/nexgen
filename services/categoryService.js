/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const Course = require("../models/courseModel");
const Lessons = require("../models/lessonModel");
const Reviews = require("../models/reviewModel");
const Category = require("../models/categoryModel");

const factory = require("./handllerFactory");

//@desc get list of categories
//@route GET /api/v1/categories
//@access public
exports.getCategories = factory.getALl(Category, "Category");

//@desc get specific category by id
//@route GET /api/v1/categories/:id
//@access public
exports.getCategory = factory.getOne(Category);

//@desc create category
//@route POST /api/v1/categories
//@access private
exports.createCategory = factory.createOne(Category);

//@desc update specific category
//@route PUT /api/v1/categories/:id
//@access private
exports.updateCategory = factory.updateOne(Category);

//@desc delete category
//@route DELETE /api/v1/categories/:id
//@access private
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  await mongoose.connection
    .transaction(async (session) => {
      // Find and delete the category
      const category = await Category.findByIdAndDelete(req.params.id).session(
        session
      );

      // Check if category exists
      if (!category) {
        return next(
          new ApiError(`Category not found for this id ${req.params.id}`, 404)
        );
      }

      // Find associated courses
      const courses = await Course.find({ category: category._id }).session(
        session
      );

      // Use Promise.all to parallelize deletion of related data
      await Promise.all([
        Course.deleteMany({
          _id: { $in: courses.map((course) => course._id) },
        }).session(session),
        Lessons.deleteMany({
          course: { $in: courses.map((course) => course._id) },
        }).session(session),
        Reviews.deleteMany({
          course: { $in: courses.map((course) => course._id) },
        }).session(session),
      ]);

      // Return success response
      res.status(204).send();
    })
    .catch((error) => {
      // Handle any transaction-related errors
      console.error("Transaction error:", error);
      return next(new ApiError("Error during transaction", 500));
    });
});
