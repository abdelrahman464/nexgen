const express = require('express');

const {
  createPackageValidator,
  updatePackageValidator,
  packageIdValidator,
} = require('../utils/validators/packageValidator');
const packageService = require('../services/packageService');
const authServices = require('../services/authServices');

const router = express.Router();

// for admin and instructors
router.get(
  '/getAll',
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  packageService.filterInstructorPackages,
  packageService.applyObjectFilters,
  packageService.getAll,
);

router
  .route('/')
  .get(
    authServices.optionalAuth,
    packageService.filterPackages,
    packageService.applyObjectFilters,
    packageService.getAll,
  )
  .post(
    authServices.protect,
    authServices.checkIfUserIsAdminOrInstructor,
    packageService.uploadPackageImage,
    packageService.resizeImage,
    packageService.convertToArray,
    packageService.assignNextPackageOrder,
    createPackageValidator,
    packageService.createOne,
  );

router
  .route('/reorder')
  .get(
    authServices.protect,
    authServices.allowedTo('admin'),
    packageService.getPackagesReorderItems,
  )
  .patch(
    authServices.protect,
    authServices.allowedTo('admin'),
    packageService.updatePackagesOrder,
  );

router
  .route('/:id')
  .get(packageService.getOne)
  .put(
    authServices.protect,
    authServices.checkIfUserIsAdminOrInstructor,
    packageService.uploadPackageImage,
    packageService.resizeImage,
    packageIdValidator,
    packageService.convertToArray,
    updatePackageValidator,
    packageService.updateOne,
  )
  .delete(
    authServices.protect,
    packageIdValidator,
    authServices.checkIfUserIsAdminOrInstructor,
    packageService.deleteOne,
  );

module.exports = router;
