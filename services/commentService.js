const asyncHandler = require("express-async-handler");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const Comment = require("../models/commentModel");
const factory = require("./handllerFactory");
const ApiError = require("../utils/apiError");
const { uploadSingleFile } = require("../middlewares/uploadImageMiddleware");

//upload Singel image
exports.uploadCommentImage = uploadSingleFile("image");
//image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf(".")
    ); // Extract file extension
    const newFileName = `comment-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith("image/")) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/commentPost/${newFileName}`;

      await sharp(file.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new profile image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          "Unsupported file type. Only images are allowed for Comment.",
          400
        )
      );
    }
  }
  next();
});
//filter comments in specefic post by post id
exports.createFilterObj = (req, res, next) => {
  let filterObject = {};
  if (req.params.postId) filterObject = { post: req.params.postId };
  req.filterObj = filterObject;
  next();
};

exports.setPostAndUserIdToBody = (req, res, next) => {
  //set user id in the body i will take it from logged user
  req.body.user = req.user._id;
  req.body.post = req.params.postId;
  next();
};

exports.setCommentAndUserIdToBody = (req, res, next) => {
  //set user id in the body i will take it from logged user
  req.body.user = req.user._id;
  req.body.comment = req.params.id; //comment id
  next();
};

exports.filterReplies = (req, res, next) => {
  req.filterObj = { comment: req.params.id };
  next();
};

//@desc create a new group
//@route POST /api/v1/postComments
//@access protected user
exports.createComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.create(req.body);
  const newComment = await Comment.findById(comment._id).populate({
    path: "user",
    select: "name profileImg",
  });
  res.status(201).json({ status: "success", data: newComment });
});
//@desc get all comments
//@route GET /api/v1/postComments
//@access protected user
exports.getAllComment = factory.getALl(Comment);
//@desc get comment
//@route GET /api/v1/postComments/:commentId
//@access protected user
exports.getComment = factory.getOne(Comment, "user");
//@desc update comment
//@route POST /api/v1/postComments/:commentId
//@access protected user that created the comment
exports.updateComment = factory.updateOne(Comment);
//@desc delete comment
//@route POST /api/v1/postComments/:commentId
//@access protected user that created the comment
exports.deleteComment = factory.deleteOne(Comment);

//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
exports.replyToComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  const { content } = req.body;

  // Validate userId and content
  if (!userId || !content) {
    return next(new ApiError("Missing userId or content", 400));
  }

  // Use findOneAndUpdate to add the reply directly in the database
  const updatedComment = await Comment.findOneAndUpdate(
    { _id: commentId }, // find a document by its ID
    { $push: { repiles: { user: userId, content } } }, // push the new reply into the replies array
    { new: true, runValidators: true } // return the updated document and run schema validators
  );
  // Check if the document was found and updated
  if (!updatedComment) {
    return next(new ApiError("Parent Comment Not Found", 404));
  }

  return res.status(201).json({ status: "success", data: updatedComment });
});

//---------------------------------------------------------------------------------------------
exports.editReplyComment = asyncHandler(async (req, res) => {
  const { replyId } = req.params;
  const { content } = req.body;

  // Construct a dynamic query to update the nested document directly
  const updatePath = `replies.$.content`; // The $ operator in the path indicates the position of the array to update

  // Use findOneAndUpdate with the $set operator to update the reply content
  const updatedComment = await Comment.findOneAndUpdate(
    { "replies._id": replyId }, // Match condition to find the parent comment with the specific reply
    { $set: { [updatePath]: content } }, // Dynamic update to the reply's content
    { new: true, runValidators: true } // Options to return updated document and run validators
  ).populate({ path: "replies.user", select: "name profileImg" }); // Optionally, repopulate user details

  // Check if the document was found and updated
  if (!updatedComment) {
    return res.status(404).json({ error: "Parent comment or reply not found" });
  }

  // Respond with the updated comment document
  return res.status(200).json({ status: "success", data: updatedComment });
});
//---------------------------------------------------------------------------------------------
exports.deleteReplyComment = asyncHandler(async (req, res) => {
  const { replyId } = req.params;

  // Directly update the document by pulling the reply from the replies array
  const updatedComment = await Comment.findOneAndUpdate(
    { "replies._id": replyId }, // Find the parent comment containing the reply
    { $pull: { replies: { _id: replyId } } }, // Command to remove the reply
    { new: true } // Return the modified document rather than the original
  );

  // Check if the document was found and updated
  if (!updatedComment) {
    return res.status(404).json({ error: "Comment with reply not found" });
  }

  // Respond with success
  return res
    .status(200)
    .json({ status: "successfully deleted", data: updatedComment });
});
