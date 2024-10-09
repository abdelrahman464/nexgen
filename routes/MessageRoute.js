const express = require("express");
const {
  getMessageValidator,
} = require("../utils/validators/messagesValidator");
const {
  replyToMessage,
  getRepliesToMessage,
  uploadMedia,
  resiz,
  addMessage,
  getMessage,
  updateMessage,
  deleteMessage,
  toggleReactionToMessage,
  createFilterObj,
} = require("../services/MessageServices");
const authServices = require("../services/authServices");

const router = express.Router();

router.post("/:chatId", authServices.protect, uploadMedia, resiz, addMessage);
router.get(
  "/:chatId",
  authServices.protect,
  getMessageValidator,
  createFilterObj,
  getMessage
);

router.put(
  "/:messageId",
  authServices.protect,
  uploadMedia,
  resiz,
  updateMessage
);
router.post(
  "/:messageId/reply",
  authServices.protect,
  uploadMedia,
  resiz,
  replyToMessage
);
router.get("/:messageId/replies", authServices.protect, getRepliesToMessage);
router.delete("/:messageId", authServices.protect, deleteMessage);
router.post(
  "/:messageId/reactions",
  authServices.protect,
  toggleReactionToMessage
);

module.exports = router;
