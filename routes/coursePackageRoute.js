const express = require('express');

const coursePackageValidator = require('../utils/validators/coursePackageValidator');
const coursePackage = require('../services/coursePackageServices');

const authServices = require('../services/authServices');

const router = express.Router();

router
  .route('/')
  .get(coursePackage.getCoursePackages)
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    coursePackage.uploadCoursePackageImage,
    coursePackage.resizeImage,
    coursePackageValidator.createCoursePackageValidator,
    coursePackage.createCoursePackage,
  );
router
  .route('/:id')
  .get(coursePackage.getCoursePackage)
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    coursePackage.uploadCoursePackageImage,
    coursePackage.resizeImage,
    coursePackageValidator.updateCoursePackageValidator,
    coursePackage.updateCoursePackage,
  )
  .delete(
    authServices.protect,
    authServices.allowedTo('admin'),
    coursePackage.deleteCoursePackage,
  );
router
  .route('/:packageId')
  .get(
    authServices.allowedTo('admin'),
    coursePackage.findUniqueUsersByPackageId,
  );
module.exports = router;
