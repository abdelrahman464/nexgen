const express = require("express");

const authServices = require("../services/authServices");
const {
  addReact,
  createFilterObj,
  getAllReactions,
} = require("../services/reactionService");

const router = express.Router();
router
  .route("/post/:postId?")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    createFilterObj,
    getAllReactions
  )
  .post(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    addReact
  );

module.exports = router;
