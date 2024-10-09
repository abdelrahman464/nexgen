const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const SystemReview = require("../models/systemReviewModel");
const factory = require("./handllerFactory");

//@desc get list of SystemReview
//@route GET /api/v1/contactInfo
//@access private
exports.filterToGetMyReviews = (req, res, next) => {
  const filterObject = { user: req.user._id };

  req.filterObj = filterObject;
  next();
};
exports.getAll = factory.getALl(SystemReview, "SystemReview");

//@desc get specific SystemReview by id
//@route GET /api/v1/systemReviews/:id
//@access private
exports.getOne = factory.getOne(SystemReview);

//@desc create SystemReview
//@route POST /api/v1/systemReviews
//@access protected
//nested route
exports.setUserIdToBody = (req, res, next) => {
  //logged user
  req.body.user = req.user._id;
  next();
};
exports.create = factory.createOne(SystemReview);

//@desc delete SystemReview
//@route DELETE /api/v1/systemReviews/:id
//@access private
exports.delete = factory.deleteOne(SystemReview);
//@desc update SystemReview
//@route Put /api/v1/systemReviews/:id
//@access private
exports.update = factory.updateOne(SystemReview);
//@desc replay to SystemReview
//@route Put /api/v1/systemReviews/:id/replay
//@access private
exports.replay = asyncHandler(async (req, res, next) => {
  const review = await SystemReview.findByIdAndUpdate(
    req.params.id,
    {
      replay: req.body.replay,
    },
    {
      new: true,
    }
  );
  if (!review) {
    return next(new ApiError(`No document For this id ${req.params.id}`, 404));
  }
  res.status(200).json({ data: review });
});
