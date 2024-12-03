const MarketerRating = require("../../models/marketersRatingModel");
const factory = require("../handllerFactory");

// GET courses/:courseId/reviews
exports.filterMarketerObjects = (req, res, next) => {
  let filterObject = {};
  if (req.query.marketer) filterObject = { marketer: req.query.marketer };
  req.filterObj = filterObject;
  next();
};

//@desc get list of MarketerRatings
//@route GET /api/v1/marketerRating
//@access public
exports.getAll = async (req, res) => {
  let docs;
  if (req.filterObj?.marketer) {
    docs = await MarketerRating.find(req.filterObj);
  } else {
    docs = await MarketerRating.aggregate([
      {
        // Group by the 'marketer' field
        $group: {
          _id: "$marketer", // Group by 'marketer' field
          ratings: { $push: "$$ROOT" }, // Collect all documents for each 'marketer'
        },
      },
    ]);
  }
  return res.status(200).json({ status: "success", data: docs });
};
//@desc get specific Review by id
//@route GET /api/v1/marketerRating/:id
//@access public
exports.getOne = factory.getOne(MarketerRating);

//@desc create Review
//@route POST /api/v1/marketerRating
//@access private/protect/user
exports.createOne = (req, res) => {
  req.body.rater = req.user._id;
  return factory.createOne(MarketerRating)(req, res);
};
//@desc delete Review
//@route DELETE /api/v1/marketerRating/:id
//@access private/protect/user-admin
exports.deleteOne = factory.deleteOne(MarketerRating);
