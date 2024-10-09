const Package = require("../models/packageModel");
const factory = require("./handllerFactory");

exports.convertToArray = (req, res, next) => {
  if (req.body.highlights) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.highlights)) {
      req.body.highlights = [req.body.highlights];
    }
  }
  next();
};
//@desc get list of collections
//@route GET /api/v1/collections
//@access public
exports.getAll = factory.getALl(Package, "Package");
//@desc get specific collection by id
//@route GET /api/v1/collections/:id
//@access public
exports.getOne = factory.getOne(Package);

//@desc create collection
//@route POST /api/v1/collections
//@access private
exports.createOne = factory.createOne(Package);

//@desc update specific collection
//@route PUT /api/v1/collections/:id
//@access private
exports.updateOne = factory.updateOne(Package);

//@desc delete collection
//@route DELETE /api/v1/collections/:id
//@access private
exports.deleteOne = factory.deleteOne(Package);
