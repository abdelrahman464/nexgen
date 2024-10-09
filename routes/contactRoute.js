const express = require("express");

const contactService = require("../services/contactService");

const authServices = require("../services/authServices");

const router = express.Router();

router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    contactService.getAll
  )
  .post(contactService.create);
router
  .route("/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    contactService.getOne
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    contactService.delete
  );

module.exports = router;
