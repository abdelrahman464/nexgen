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

