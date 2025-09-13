const express = require("express");

const {
  createPackageValidator,
  updatePackageValidator,
  packageIdValidator,
} = require("../utils/validators/packageValidator");
const packageService = require("../services/packageService");
const authServices = require("../services/authServices");

const router = express.Router();

// for admin and instructors
router.get(
  "/getAll",
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  packageService.filterInstructorPackages,
  packageService.getAll
);

router
  .route("/")
  .get(
    authServices.optionalAuth,
    packageService.filterPackages,
    packageService.getAll
  )
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    packageService.uploadPackageImage,
    packageService.resizeImage,
    packageService.convertToArray,
    createPackageValidator,
    packageService.createOne
  );
router
  .route("/:id")
  .get(packageIdValidator, packageService.getOne)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    packageService.uploadPackageImage,
    packageService.resizeImage,
    packageIdValidator,
    packageService.convertToArray,
    updatePackageValidator,
    packageService.updateOne
  )
  .delete(
    authServices.protect,
    packageIdValidator,
    authServices.allowedTo("admin"),
    packageService.deleteOne
  );

module.exports = router;
