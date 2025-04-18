const express = require("express");

const {
  hasInvitor,
  isAuthorized,
  analyticPerformanceValidator,
  isRequestFromHisTrainer,
} = require("../utils/validators/analyticValidator");
const { isUserSubscribed } = require("../utils/public/publicValidator");
const authServices = require("../services/authServices");
const {
  uploadMedia,
  resize,
  checkUserSubscription,
  filterStatus,
  assignIds,
  filterOnUserRole,
  createOne,
  getAll,
  getOne,
  updateOne,
  deleteOne,
  getAnalyticsPerformance,
} = require("../services/analyticService");
const {
  checkMongoId,
  isIdParamForSender,
} = require("../utils/public/publicValidator");
//create router
const router = express.Router();
//configure router
//1
router.get(
  "/user-analytic/:id", //id is the user id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  isIdParamForSender,
  filterOnUserRole,
  filterStatus,
  getAll
);
//  2
router.get(
  "/user-analytic-performance/:id", //id is the userId
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  analyticPerformanceValidator,
  isRequestFromHisTrainer,
  getAnalyticsPerformance
);
// -- 3
router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    filterStatus,
    getAll
  )
  // -- 4
  .post(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    checkUserSubscription,
    uploadMedia,
    resize,
    // hasInvitor,
    // processPostValidator,
    assignIds,
    createOne
  );
router // -- 5
  .route("/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    checkMongoId("id"),
    isAuthorized,
    getOne
  ) // -- 6
  .put(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    isAuthorized,
    updateOne
  ) // -- 7
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    isAuthorized,
    // processPostValidator,
    deleteOne
  );

//router object contains 7 routes
module.exports = router;
