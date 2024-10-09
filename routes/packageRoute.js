const express = require("express");

const packageService = require("../services/packageService");
const authServices = require("../services/authServices");

const router = express.Router();
router
  .route("/")
  .get(packageService.getAll)
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    packageService.convertToArray,
    packageService.createOne
  );
router
  .route("/:id")
  .get(packageService.getOne)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    packageService.convertToArray,
    packageService.updateOne
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    packageService.deleteOne
  );

module.exports = router;
