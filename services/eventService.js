const asyncHandler = require('express-async-handler');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const { uploadSingleFile } = require('../middlewares/uploadImageMiddleware');
const Event = require('../models/eventModel');
//upload Singel image
exports.uploadImage = uploadSingleFile('image');
//image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf('.'),
    ); // Extract file extension
    const newFileName = `eventImage-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith('image/')) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/events/${newFileName}`;

      await sharp(file.buffer)
        .toFormat('webp') // Convert to WebP
        .webp({ quality: 97 })
        .toFile(filePath);

      // Update the req.body to include the path for the new profile image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          'Unsupported file type. Only images are allowed for event image.',
          400,
        ),
      );
    }
  }
  next();
});

//@desc get list of events
//@route GET /api/v1/events
//@access public
exports.getEvents = factory.getALl(Event, 'Event');
//@desc get specific event by id
//@route GET /api/v1/events/:id
//@access public
exports.getEvent = factory.getOne(Event);

//@desc create event
//@route POST /api/v1/events
//@access private
exports.createEvent = factory.createOne(Event);

//@desc update specific event
//@route PUT /api/v1/events/:id
//@access private
exports.updateEvent = factory.updateOne(Event);
//@desc delete specific event
//@route DELETE /api/v1/events/:id
//@access private
exports.deleteEvent = factory.deleteOne(Event);
