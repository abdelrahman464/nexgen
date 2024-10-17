const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Lesson = require('../models/lessonModel');
const Section = require('../models/sectionModel');
const factory = require('./handllerFactory');

//@desc get list of sections
//@route GET /api/v1/sections
//@access public
exports.filterSectionsByCourse = async (req, res, next) => {
  const filterObject = { course: req.params.courseId };
  req.filterObj = filterObject;
  next();
};

exports.getSections = factory.getALl(Section, 'Section');

//@desc get specific Section by id
//@route GET /api/v1/sections/:id
//@access public
exports.getSection = factory.getOne(Section);

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
  await mongoose.connection
    .transaction(async (session) => {
      // Find and delete the Section
      const section = await Section.findByIdAndDelete(req.params.id).session(
        session,
      );

      // Check if Section exists
      if (!section) {
        return next(
          new ApiError(`Section not found for this id ${req.params.id}`, 404),
        );
      }

      //delete all lessons in this section
      await Lesson.deleteMany({ section: Section._id }).session(session);

      // Return success response
      res.status(204).send();
    })
    .catch((error) => {
      // Handle any transaction-related errors
      console.error('Transaction error:', error);
      return next(new ApiError('Error during transaction', 500));
    });
});
