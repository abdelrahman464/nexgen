const express = require("express");
const {
  deleteCommentValidator,
  updateCommentValidator,
  getCommentValidator,
  postIdValidator,
  replyToCommentValidator,
  updateReplyValidator,
  deleteReplyValidator,
} = require("../utils/validators/commentValidator");

const { isUserSubscribed } = require("../utils/public/publicValidator");

const authServices = require("../services/authServices");

const {
  uploadCommentImage,
  resizeImage,
  createComment,
  getComment,
  getAllComment,
  deleteComment,
  updateComment,
  createFilterObj,
  setPostAndUserIdToBody,
  setCommentAndUserIdToBody,
  filterReplies,
  // replyToComment,
  // editReplyComment,
  // deleteReplyComment,
} = require("../services/commentService");

const router = express.Router();

router.get("/replies/:id", filterReplies, getAllComment);

router
  .route("/post/:postId")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    createFilterObj,
    postIdValidator,
    getAllComment
  ) //create comment
  .post(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    isUserSubscribed,
    uploadCommentImage,
    resizeImage,
    setPostAndUserIdToBody,
    postIdValidator,
    createComment
  );

router
  .route("/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    getCommentValidator,
    getComment
  )
  .put(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    uploadCommentImage,
    resizeImage,
    updateCommentValidator,
    updateComment
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    deleteCommentValidator,
    deleteComment
  );
//reply to comment
router
  .route("/replyToComment/:id")
  .put(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    isUserSubscribed,
    replyToCommentValidator,
    setCommentAndUserIdToBody,
    createComment
  );
router
  .route("/editReplyComment/:id")
  .put(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    updateReplyValidator,
    updateComment
  );
router
  .route("/deleteReplyComment/:id")
  .delete(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    deleteReplyValidator,
    deleteComment
  );

module.exports = router;
