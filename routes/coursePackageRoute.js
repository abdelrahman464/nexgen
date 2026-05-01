const express = require('express');

const coursePackageValidator = require('../utils/validators/coursePackageValidator');
const coursePackage = require('../services/coursePackageServices');

const authServices = require('../services/authServices');

const router = express.Router();

router.get(
  '/getAll',
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  coursePackage.filterCoursePackages,
  coursePackage.applyObjectFilters,
  coursePackage.getCoursePackages,
);
router
  .route('/')
  .get(
    coursePackage.filterActiveCoursePackages,
    coursePackage.applyObjectFilters,
    coursePackage.getCoursePackages,
  )
  .post(
    authServices.protect,
    authServices.checkIfUserIsAdminOrInstructor,
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
    authServices.checkIfUserIsAdminOrInstructor,
    coursePackage.uploadCoursePackageImage,
    coursePackage.resizeImage,
    coursePackageValidator.updateCoursePackageValidator,
    coursePackage.updateCoursePackage,
  )
  .delete(
    authServices.protect,
    authServices.checkIfUserIsAdminOrInstructor,
    coursePackage.deleteCoursePackage,
  );
router
  .route('/:packageId')
  .get(
    authServices.allowedTo('admin'),
    coursePackage.findUniqueUsersByPackageId,
  );
module.exports = router;
