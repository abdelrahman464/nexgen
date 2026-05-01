const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const CoursePackage = require('../models/coursePackageModel');
const Order = require('../models/orderModel');
const factory = require('./handllerFactory');
const Course = require('../models/courseModel');
const { uploadSingleFile } = require('../middlewares/uploadImageMiddleware');
const ApiError = require('../utils/apiError');
const {
  checkIfCoursePackageHasAllFields,
} = require('../helpers/coursePackageHelper');
const {
  assignNextOrder,
  getReorderItems,
  updateItemsOrder,
} = require('./reorderService');
//upload course image
exports.uploadCoursePackageImage = uploadSingleFile('image');
//image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf('.'),
    ); // Extract file extension
    const newFileName = `coursePackage-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith('image/')) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/coursePackages/${newFileName}`;

      await sharp(file.buffer)
        .toFormat('webp') // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new course package image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          'Unsupported file type. Only images are allowed for courses package.',
          400,
        ),
      );
    }
  }
  next();
});
//@desc get list of CoursePackages
//@route GET /api/v1/categories
//@access public
exports.filterCoursePackages = async (req, res, next) => {
  const filterObj = {};
  if (req.user.role !== 'admin' && req.user.isInstructor) {
    const courses = await Course.find({ instructor: req.user._id });

    if (courses.length === 0) {
      return res.status(200).json({ results: 0, data: [] });
    }
    filterObj.$or = [
      { instructor: req.user._id },
      { courses: { $in: courses.map((course) => course._id) } },
    ];
  }
  req.filterObj = filterObj;
  return next();
};

exports.filterActiveCoursePackages = async (req, res, next) => {
  req.filterObj = { status: 'active' };

  return next();
};

exports.applyObjectFilters = (req, res, next) => {
  req.filterObj = req.filterObj || {};
  const { title, description, keyword, category, status } = req.query;
  const orFilters = [];
  if (category) {
    req.filterObj.category = category;
  }
  if (status && req.user && (req.user.role === 'admin' || req.user.isInstructor)) {
    req.filterObj.status = status;
  }
  if (keyword) {
    const textPattern = new RegExp(keyword, 'i');
    orFilters.push(
      { 'title.ar': { $regex: textPattern } },
      { 'title.en': { $regex: textPattern } },
      { 'description.ar': { $regex: textPattern } },
      { 'description.en': { $regex: textPattern } },
    );
  }
  if (title) {
    orFilters.push({ 'title.ar': title }, { 'title.en': title });
  }
  if (description) {
    orFilters.push(
      { 'description.ar': description },
      { 'description.en': description },
    );
  }
  if (orFilters.length > 0) {
    if (req.filterObj.$or) {
      req.filterObj.$and = [
        ...(req.filterObj.$and || []),
        { $or: req.filterObj.$or },
        { $or: orFilters },
      ];
      delete req.filterObj.$or;
    } else {
      req.filterObj.$or = [...(req.filterObj.$or || []), ...orFilters];
    }
  }
  return next();
};
exports.getCoursePackages = factory.getALl(CoursePackage, 'CoursePackage');
exports.assignNextCoursePackageOrder = assignNextOrder(CoursePackage);
exports.getCoursePackagesReorderItems = getReorderItems(CoursePackage);
exports.updateCoursePackagesOrder = updateItemsOrder(CoursePackage);

//@desc get specific CoursePackage by id
//@route GET /api/v1/coursePackages/:id
//@access public
exports.getCoursePackage = factory.getOne(CoursePackage);

//@desc get specific CoursePackage by slug
//@route GET /api/v1/coursePackages/slug/:slug
//@access public
exports.getCoursePackageBySlug = factory.getOneBySlug(CoursePackage);

//@desc create CoursePackage
//@route POST /api/v1/coursePackages
//@access private
exports.createCoursePackage = (req, res, next) => {
  req.body.instructor = req.user._id;
  return factory.createOne(CoursePackage)(req, res, next);
};

//@desc update specific CoursePackage
//@route PUT /api/v1/coursePackages/:id
//@access private
exports.updateCoursePackage = async (req, res, next) => {
  try {
    const coursePackage = await CoursePackage.findById(req.params.id).lean();
    if (!coursePackage) {
      return next(
        new ApiError(res.__('errors.Not-Found', { document: 'document' }), 404),
      );
    }
    if (req.body.status && req.body.status === 'active') {
      //check if this coursePackage has all fields
      const missedFields = await checkIfCoursePackageHasAllFields(
        coursePackage,
        req.body,
      );
      if (missedFields.length > 0) {
        return next(
          new ApiError(
            `you cannot activate this CoursePackage, CoursePackage has missing required fields: ${missedFields.join(', ')}`,
            400,
          ),
        );
      }
    }
    req.body['rag.status'] = 'pending';
    req.body['rag.error'] = '';
    const result = await CoursePackage.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );
    if (!result) {
      return next(new ApiError('Failed to update coursePackage', 400));
    }
    const localizedCoursePackage =
      CoursePackage.schema.methods.toJSONLocalizedOnly(result, req.locale);
    res
      .status(200)
      .json({ status: 'updated successfully', data: localizedCoursePackage });
  } catch (error) {
    console.error('Error updating document:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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
        _id: '$user',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    {
      $unwind: '$userDetails',
    },
    {
      $project: {
        _id: 0,
        user: '$userDetails',
      },
    },
  ]);
  const r = result.map((item) => item.user);
  res.status(200).json({ result: r });
});
