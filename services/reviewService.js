const asyncHandler = require("express-async-handler");
const Review = require("../models/reviewModel");
const factory = require("./handllerFactory");
const ApiError = require("../utils/apiError");

// GET courses/:courseId/reviews
exports.createFilterObj = (req, res, next) => {
  let filterObject = {};
  if (req.params.courseId) filterObject = { course: req.params.courseId };
  req.filterObj = filterObject;
  next();
};

exports.createUserFilterObj = (req, res, next) => {
  const filterObject = { user: req.user._id };
  req.filterObj = filterObject;
  next();
};

//nested route
exports.setCourseIdAndUserIdToBody = (req, res, next) => {
  //Nested Route
  if (!req.body.course) req.body.course = req.params.courseId;
  //if you didn't send  user id in the body i will take it from logged user
  //logged user
  if (!req.body.user) req.body.user = req.user._id;
  next();
};

//@desc get list of Review
//@route GET /api/v1/reviews
//@access public
exports.getReviews = factory.getALl(Review);

//@desc get specific Review by id
//@route GET /api/v1/reviews/:id
//@access public
exports.getReview = factory.getOne(Review);

//@desc create Review
//@route POST /api/v1/reviews
//@access private/protect/user
exports.createReview = factory.createOne(Review);

//@desc update specific Review
//@route PUT /api/v1/reviews/:id
//@access private/protect/user
exports.updateReview = asyncHandler(async (req, res, next) => {
  const document = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!document) {
    return next(new ApiError(`No document for this id ${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});

//@desc delete Review
//@route DELETE /api/v1/reviews/:id
//@access private/protect/user-admin
exports.deleteReview = factory.deleteOne(Review);
//@desc reply to Review
//@route PUT /api/v1/:id/replay
//@access private
exports.replyToReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findOneAndUpdate(
    { _id: req.params.id },
    { reply: req.body.reply },
    { new: true }
  );
  if (!review) {
    return next(new ApiError(`No document For this id ${req.params.id}`, 404));
  }
  return res.status(200).json({ msg: `updated`, data: review });
});
