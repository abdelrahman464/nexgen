const express = require("express");
const {
  uploadImage,
  resizeImage,
  createChat,
  findChat,
  createGroupChat,
  addParticipantToChat,
  removeParticipantFromChat,
  updateParticipantRoleInChat,
  getChatDetails,
  updateGroupChat,
  deleteChat,
  pinMessageInChat,
  unpinMessageInChat,
  archiveChat,
  unarchiveChat,
  getMyChats,
  getAllChats,
  customerService,
  addUserToCourseChats,
} = require("../services/ChatServices");
const authServices = require("../services/authServices");

const router = express.Router();
router.post("/addUserToCourseChats", addUserToCourseChats);

router.post(
  "/:receiverId",
  authServices.protect,
  authServices.allowedTo("admin"),
  createChat
);

router.post(
  "/",
  authServices.protect,
  authServices.allowedTo("admin"),
  uploadImage,
  resizeImage,
  createGroupChat
);
router.get(
  "/",
  authServices.protect,
  authServices.allowedTo("admin"),
  getAllChats
);

router.get("/myChats", authServices.protect, getMyChats);
router.get("/find/:secondPersonId", authServices.protect, findChat);

router.put(
  "/:chatId/addParticipant",
  authServices.protect,
  addParticipantToChat
);
router.put(
  "/:chatId/removeParticipant",
  authServices.protect,
  removeParticipantFromChat
);
router.put(
  "/:chatId/updateParticipantRole",
  authServices.protect,
  updateParticipantRoleInChat
);
router.get("/:chatId/details", authServices.protect, getChatDetails);
router.put(
  "/:chatId/updateGroup",
  authServices.protect,
  uploadImage,
  resizeImage,
  updateGroupChat
);
router.delete("/:chatId", authServices.protect, deleteChat);
router.post("/:chatId/pin/:messageId", authServices.protect, pinMessageInChat);
router.delete(
  "/:chatId/unpin/:messageId",
  authServices.protect,
  unpinMessageInChat
);
router.put("/:chatId/archive", authServices.protect, archiveChat);
router.put("/:chatId/unarchive", authServices.protect, unarchiveChat);

router.post("/customerService", authServices.protect, customerService);

// Add user to all course chats as admin

// Test route to update existing course chat types (for development)
router.post("/customerService", authServices.protect, customerService);

module.exports = router;
