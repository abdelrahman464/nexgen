const { check, param } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const Comment = require("../../models/commentModel");
const Post = require("../../models/postModel");
const ApiError = require("../apiError");

const checkCommentOwnership = async (commentId, userId, userRole) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    return Promise.reject(new ApiError("Comment Not Found", 404));
  }

  if (comment.user._id.toString() !== userId && userRole !== "admin") {
    return Promise.reject(
      new ApiError("You are not allowed to perform this action", 403)
    );
  }
};
exports.postIdValidator = [
  param("postId")
    .isMongoId()
    .withMessage("Invalid post ID format")
    .custom(async (val, { req }) => {
      const post = await Post.findById(val);
      if (!post) {
        throw new ApiError("Post Not Found", 404);
      }
    }),
  validatorMiddleware,
];

exports.updateCommentValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Request ID format")
    .custom(async (val, { req }) => {
      await checkCommentOwnership(val, req.user._id.toString(), req.user.role);
    }),
  validatorMiddleware,
];

exports.deleteCommentValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Request ID format")
    .custom(async (val, { req }) => {
      await checkCommentOwnership(val, req.user._id.toString(), req.user.role);
    }),
  validatorMiddleware,
];

exports.getCommentValidator = [
  check("id").isMongoId().withMessage("Invalid Request ID format"),
  validatorMiddleware,
];
//--------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------

const checkReplyOwnership = async (replyId, userId, userRole) => {
  const comment = await Comment.findOne({ "_id": replyId});
  if (!comment) {
    return Promise.reject(
      new ApiError("Comment containing the reply not found", 404)
    );
  }

  if (comment.user.toString() !== userId && userRole !== "admin") {
    return Promise.reject(
      new ApiError("You are not allowed to perform this action", 403)
    );
  }
};
exports.replyToCommentValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Comment ID format")
    .custom(async (commentId, { req }) => {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return Promise.reject(new ApiError("Comment Not Found", 404));
      }
    }),
  validatorMiddleware,
];

exports.updateReplyValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Reply ID format")
    .custom((replyId, { req }) =>
      checkReplyOwnership(replyId, req.user._id.toString(), req.user.role)
    ),
  validatorMiddleware,
];

exports.deleteReplyValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Reply ID format")
    .custom((replyId, { req }) =>
      checkReplyOwnership(replyId, req.user._id.toString(), req.user.role)
    ),
  validatorMiddleware,
];
