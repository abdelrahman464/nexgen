const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");

const factory = require("./handllerFactory");
const ApiError = require("../utils/apiError");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");

const Artical = require("../models/articalModel");


exports.uploadImages = uploadMixOfFiles([
  {
    name: "imageCover",
    maxCount: 1,
  },
  {
    name: "images",
    maxCount: 20,
  },
]);

exports.resizeImages = asyncHandler(async (req, res, next) => {
  // Image processing for imageCover
  if (
    req.files.imageCover &&
    req.files.imageCover[0].mimetype.startsWith("image/")
  ) {
    const imageCoverFileName = `artical-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.imageCover[0].buffer)
      .toFormat("webp") // Convert to WebP
      .webp({ quality: 95 })
      .toFile(`uploads/blog/artical/${imageCoverFileName}`);

    // Save imageCover file name in the request body for database saving
    req.body.imageCover = imageCoverFileName;
  } else if (req.files.imageCover) {
    return next(new ApiError("Image cover is not an image file", 400));
  }

  // Image processing for images
  if (req.files.images) {
    const imageProcessingPromises = req.files.images.map(async (img, index) => {
      if (!img.mimetype.startsWith("image/")) {
        throw new ApiError(`File ${index + 1} is not an image file.`, 400);
      }

      const imageName = `artical-${uuidv4()}-${Date.now()}-${index + 1}.webp`;

      await sharp(img.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(`uploads/blog/artical/${imageName}`);

      return imageName;
    });

    try {
      const processedImages = await Promise.all(imageProcessingPromises);
      req.body.images = processedImages;
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// @desc    Create new artical
// @router  POST /api/v1/articals
// @access  public/protected
exports.createArtical = factory.createOne(Artical);

// @desc    Get All articals
// @router  Get /api/v1/articals
// @access  Public
exports.getAllArticals = factory.getALl(Artical, "Artical");

// @desc    Get Specific artical
// @router  Get /api/v1/articals/:id
// @access  public
exports.getOneArtical = factory.getOne(Artical);

// @desc    Update Specific articals
// @router  PUT /api/v1/articals/:id
// @access  private/protected
exports.updateArtical = factory.updateOne(Artical);

// @desc    Delete Specific artical
// @router  DELETE /api/v1/articals/:id
// @access  private/protected (admin and logged user for his Artical)
exports.deleteArtical = factory.deleteOne(Artical);
