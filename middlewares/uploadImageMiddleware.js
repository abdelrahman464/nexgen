const multer = require("multer");
const ApiError = require("../utils/apiError");

// Configure multer for image, PDF, and Word document upload
const multerOptions = () => {
  const multerStorage = multer.memoryStorage();

  const multerFilter = (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword", // For .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // For .docx
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError("Unsupported file type.", 400), false);
    }
  };

  return multer({ storage: multerStorage, fileFilter: multerFilter });
};

// Upload a single file field
exports.uploadSingleFile = (fieldName) => multerOptions().single(fieldName);

// Upload mixed file types for specified fields
exports.uploadMixOfFiles = (arrayOfFields) =>
  multerOptions().fields(arrayOfFields);
