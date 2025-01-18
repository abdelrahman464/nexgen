const express = require("express");
const CouponService = require("../services/couponService");
const authServices = require("../services/authServices");
const {
  createCouponValidator,
  updateCouponValidator,
  canPerformCouponAction,
} = require("../utils/validators/couponValidator");
//initialize router object
const router = express.Router();
//@usage : get coupon details by coupon name during checkout
//@actor: user
router.get(
  "/getCouponDetails/:couponName",
  authServices.protect,
  CouponService.getCouponDetails
);
router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    CouponService.filterCoupons, // if actor is user, filter his coupons
    CouponService.getAll
  )
  .post(
    authServices.protect,
    canPerformCouponAction,
    createCouponValidator,
    CouponService.createOne
  );

router
  .route("/:id")
  .get(authServices.protect, canPerformCouponAction, CouponService.getOne)
  .put(
    authServices.protect,
    updateCouponValidator,
    canPerformCouponAction,
    CouponService.updateOne
  )
  .delete(
    authServices.protect,
    canPerformCouponAction,
    CouponService.deleteOne
  );

module.exports = router;
