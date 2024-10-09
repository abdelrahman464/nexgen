const express = require("express");
const authServices = require("../services/authServices");
const {
  uploadMarketingRequestPdfs,
  handleMarketingReqsPdfs,
  filterReqs,
  canSendMarketingRequest,
  createMarketingRequest,
  getAllMarketingRequests,
  getMarketingRequestbyId,
  deleteMarketingRequest,
  acceptMarketingRequest,
  rejectMarketingRequest,
} = require("../services/marketingReqService");
// const {
//   createmarketingReqValidator,
// } = require("../utils/validators/martingValidator/marketRequestsValidator");

const router = express.Router();
router
  .route("/")
  .post(
    authServices.protect,
    canSendMarketingRequest,
    uploadMarketingRequestPdfs,
    handleMarketingReqsPdfs,
    // createmarketingReqValidator,
    createMarketingRequest
  )
  .get(authServices.protect, filterReqs, getAllMarketingRequests);

router
  .route("/:id")
  .get(getMarketingRequestbyId)
  .delete(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    deleteMarketingRequest
  );

router
  .route("/accept/:id")
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    acceptMarketingRequest
  );
router
  .route("/reject/:id")
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    rejectMarketingRequest
  );

module.exports = router;
