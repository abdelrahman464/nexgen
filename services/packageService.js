const mongoose = require('mongoose');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const Package = require('../models/packageModel');
const Post = require('../models/postModel');
const UserSubscription = require('../models/userSubscriptionModel');
const { uploadSingleFile } = require('../middlewares/uploadImageMiddleware');

//upload course image
exports.uploadPackageImage = uploadSingleFile('image');
//image processing
exports.resizeImage = async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf('.'),
    ); // Extract file extension
    const newFileName = `package-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith('image/')) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/packages/${newFileName}`;

      await sharp(file.buffer)
        .toFormat('webp') // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new  package image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          'Unsupported file type. Only images are allowed for package.',
          400,
        ),
      );
    }
  }
  next();
};
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
exports.getAll = factory.getALl(Package, 'Package');
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
exports.deleteOne = async (req, res, next) => {
  try {
    await mongoose.connection.transaction(async (session) => {
      // Find and delete the course
      const package = await Package.findByIdAndDelete(req.params.id).session(
        session,
      );

      // Check if course exists
      if (!package) {
        return next(
          new ApiError(`package not found for this id ${req.params.id}`, 404),
        );
      }

      // Delete associated lessons and reviews
      await Promise.all([
        UserSubscription.deleteMany({ package: package._id }).session(session),
        Post.deleteMany({
          package: { $elemMatch: { $eq: package._id } },
        }).session(session),
      ]);
    });

    // Return success response
    res.status(204).send();
  } catch (error) {
    // Handle any transaction-related errors

    if (error instanceof ApiError) {
      // Forward specific ApiError instances
      return next(error);
    }
    // Handle other errors with a generic message
    return next(new ApiError('Error during course deletion', 500));
  }
};
