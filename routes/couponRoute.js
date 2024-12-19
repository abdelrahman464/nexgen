const express = require("express");
const CouponService = require("../services/couponService");
const authServices = require("../services/authServices");
const {
  createCouponValidator,
  updateCouponValidator,
} = require("../utils/validators/couponValidator");
//initialize router object
const router = express.Router();

router.get(
  "/getCouponDetails/:couponName",
  authServices.protect,
  CouponService.getCouponDetails
);
router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    CouponService.getAll
  )
  .post(authServices.protect, createCouponValidator, CouponService.createOne);

router
  .route("/:id")
  .get(authServices.protect, CouponService.getOne)
  .put(authServices.protect, updateCouponValidator, CouponService.updateOne)
  .delete(authServices.protect, CouponService.deleteOne);

module.exports = router;
