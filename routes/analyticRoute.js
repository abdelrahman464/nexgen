const express = require("express");

const {
  canMakeOne,
  isAuthorized,
} = require("../utils/validators/analyticValidator");
const { isUserSubscribed } = require("../utils/public/publicValidator");
const authServices = require("../services/authServices");
const {
  uploadImage,
  resizeImage,
  filterStatus,
  assignIds,
  filterOnUserRole,
  createOne,
  getAll,
  getOne,
  updateOne,
  deleteOne,
} = require("../services/analyticService");
const { isIdParamForSender } = require("../utils/public/publicValidator");
//create router
const router = express.Router();
//configure router
router.get(
  "/user-analytic/:id", //id is the user id
  authServices.protect,
  authServices.allowedTo("user", "admin"),
  isIdParamForSender,
  filterOnUserRole,
  filterStatus,
  getAll
);
router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    filterStatus,
    getAll
  )
  .post(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    isUserSubscribed,
    uploadImage,
    resizeImage,
    canMakeOne,
    // processPostValidator,
    assignIds,
    createOne
  );
router
  .route("/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("user", "admin"),
    isAuthorized,
    getOne
  )
  .put(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    isAuthorized,
    updateOne
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    isAuthorized,
    // processPostValidator,
    deleteOne
  );

module.exports = router;
