const express = require("express");

const coursePackage = require("../services/coursePackageServices");

const authServices = require("../services/authServices");

const router = express.Router();

router
  .route("/")
  .get(coursePackage.getCoursePackages)
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    coursePackage.createCoursePackage
  );
router
  .route("/:id")
  .get(coursePackage.getCoursePackage)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    coursePackage.updateCoursePackage
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    coursePackage.deleteCoursePackage
  );
router
  .route("/:packageId")
  .get(
    authServices.allowedTo("admin"),
    coursePackage.findUniqueUsersByPackageId
  );
module.exports = router;
