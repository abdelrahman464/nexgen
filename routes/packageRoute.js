const express = require('express');

const {
  createPackageValidator,
  updatePackageValidator,
  packageIdValidator,
} = require('../utils/validators/packageValidator');
const packageService = require('../services/packageService');
const authServices = require('../services/authServices');

const router = express.Router();
router
  .route('/')
  .get(packageService.getAll)
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    packageService.convertToArray,
    createPackageValidator,
    packageService.createOne,
  );
router
  .route('/:id')
  .get(packageIdValidator, packageService.getOne)
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    packageIdValidator,
    packageService.convertToArray,
    updatePackageValidator,
    packageService.updateOne,
  )
  .delete(
    authServices.protect,
    packageIdValidator,
    authServices.allowedTo('admin'),
    packageService.deleteOne,
  );

module.exports = router;
