const mongoose = require("mongoose");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Package = require("../models/packageModel");
const Post = require("../models/postModel");
const UserSubscription = require("../models/userSubscriptionModel");
const { uploadSingleFile } = require("../middlewares/uploadImageMiddleware");
const Course = require("../models/courseModel");
const { checkIfPackageHasAllFields } = require("../helpers/packageHelper");

//upload course image
exports.uploadPackageImage = uploadSingleFile("image");
//image processing
exports.resizeImage = async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf(".")
    ); // Extract file extension
    const newFileName = `package-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith("image/")) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/packages/${newFileName}`;

      await sharp(file.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new  package image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          "Unsupported file type. Only images are allowed for package.",
          400
        )
      );
    }
  }
  next();
};
exports.convertToArray = (req, res, next) => {
  if (req.body.whatWillLearn) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.whatWillLearn)) {
      req.body.whatWillLearn = [req.body.whatWillLearn];
    }
  }
  if (req.body.coursePrerequisites) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.coursePrerequisites)) {
      req.body.coursePrerequisites = [req.body.coursePrerequisites];
    }
  }
  if (req.body.whoThisCourseFor) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.whoThisCourseFor)) {
      req.body.whoThisCourseFor = [req.body.whoThisCourseFor];
    }
  }
  next();
};

exports.filterInstructorPackages = async (req, res, next) => {
  if (req.user.role !== "admin") {
    req.filterObj = { instructor: req.user._id };
  }
  next();
};
//@desc get list of collections
//@route GET /api/v1/collections
//@access public
exports.filterPackages = async (req, res, next) => {
  const isAdmin = req.user && req.user.role === "admin";
  req.filterObj = { status: "active" };
  if (req.query.all || isAdmin) {
    req.filterObj = {};
  }
  if (req.query.keyword) {
    const textPattern = new RegExp(req.query.keyword, "i");
    req.filterObj.$or = [
      { "title.ar": { $regex: textPattern } },
      { "title.en": { $regex: textPattern } },
      { "description.ar": { $regex: textPattern } },
      { "description.en": { $regex: textPattern } },
    ];
  }
  return next();
};
exports.getAll = factory.getALl(Package, "Package");
//@desc get specific collection by id
//@route GET /api/v1/collections/:id
//@access public
exports.getOne = factory.getOne(Package);

//@desc create collection
//@route POST /api/v1/collections
//@access private
exports.createOne = async (req, res, next) => {
  const { course } = req.body;
  const courseDoc = await Course.findById(course);
  const isAllowed =
    req.user.role === "admin" ||
    courseDoc.instructor._id.toString() === req.user._id.toString();
  if (!isAllowed) {
    return next(
      new ApiError(
        "You are not allowed to create a package for this course",
        403
      )
    );
  }
  req.body.instructor = courseDoc.instructor;
  return factory.createOne(Package)(req, res, next);
};

//@desc update specific collection
//@route PUT /api/v1/collections/:id
//@access private
exports.updateOne = async (req, res, next) => {
  try {
    const package = await Package.findById(req.params.id).lean();
    if (!package) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "document" }), 404)
      );
    }
    if (req.body.status && req.body.status === "active") {
      //check if this package has all fields
      const missedFields = await checkIfPackageHasAllFields(package, req.body);
      if (missedFields.length > 0) {
        return next(
          new ApiError(
            `you cannot activate this Package, Package has missing required fields: ${missedFields.join(", ")}`,
            400
          )
        );
      }
    }
    const result = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!result) {
      return next(new ApiError("Failed to update package", 400));
    }
    const localizedPackage = Package.schema.methods.toJSONLocalizedOnly(
      result,
      req.locale
    );
    res
      .status(200)
      .json({ status: "updated successfully", data: localizedPackage });
  } catch (error) {
    console.error("Error updating document:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

//@desc delete collection
//@route DELETE /api/v1/collections/:id
//@access private
exports.deleteOne = async (req, res, next) => {
  try {
    await mongoose.connection.transaction(async (session) => {
      // Find and delete the course
      const package = await Package.findByIdAndDelete(req.params.id).session(
        session
      );

      // Check if course exists
      if (!package) {
        return next(
          new ApiError(`package not found for this id ${req.params.id}`, 404)
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
    return next(new ApiError("Error during course deletion", 500));
  }
};
