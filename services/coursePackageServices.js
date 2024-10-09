const asyncHandler = require("express-async-handler");
const CoursePackage = require("../models/coursePackageModel");
const Order = require("../models/orderModel");
const factory = require("./handllerFactory");

//@desc get list of CoursePackages
//@route GET /api/v1/categories
//@access public
exports.getCoursePackages = factory.getALl(CoursePackage, "CoursePackage");

//@desc get specific CoursePackage by id
//@route GET /api/v1/coursePackages/:id
//@access public
exports.getCoursePackage = factory.getOne(CoursePackage);

//@desc create CoursePackage
//@route POST /api/v1/coursePackages
//@access private
exports.createCoursePackage = factory.createOne(CoursePackage);

//@desc update specific CoursePackage
//@route PUT /api/v1/coursePackages/:id
//@access private
exports.updateCoursePackage = factory.updateOne(CoursePackage);

//@desc delete CoursePackage
//@route DELETE /api/v1/coursePackages/:id
//@access private
exports.deleteCoursePackage = factory.deleteOne(CoursePackage);
//@desc get users in CoursePackage
//@route DELETE /api/v1/coursePackages/:packageId
//@access private
exports.findUniqueUsersByPackageId = asyncHandler(async (req, res, next) => {
  const packageId = req.params.id;
  const result = await Order.aggregate([
    { $match: { coursePackage: packageId } },
    {
      $group: {
        _id: "$user",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    {
      $unwind: "$userDetails",
    },
    {
      $project: {
        _id: 0,
        user: "$userDetails",
      },
    },
  ]);
  const r = result.map((item) => item.user);
  res.status(200).json({ result: r });
});
