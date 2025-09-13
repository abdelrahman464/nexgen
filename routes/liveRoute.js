const express = require("express");
const { createLiveValidator } = require("../utils/validators/liveValidator");
const liveService = require("../services/liveService");

const authServices = require("../services/authServices");

const courseRoute = require("./courseRoute");

const router = express.Router();

router.use("/:categoryId/courses", courseRoute);
router.put(
  "/sendEmails/:id",
  authServices.protect,
  authServices.allowedTo("admin"),
  liveService.SendEmailsToLiveFollowers
);
router.get(
  "/getAll",
  authServices.protect,
  authServices.checkIfUserIsAdminOrInstructor,
  liveService.filterLivesByInstructor,
  liveService.getLives
);

router
  .route("/")
  .get(
    authServices.protect,
    authServices.allowedTo("admin", "user"),
    liveService.createFilterObj,
    liveService.getLives
  )
  .post(
    authServices.protect,
    authServices.checkIfUserIsAdminOrInstructor,
    createLiveValidator,
    liveService.createLive
  );
router
  .route("/:id")
  .get(
    authServices.protect,
    authServices.allowedTo("admin"),
    liveService.getLive
  )
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    liveService.updateLive
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    liveService.deleteLive
  );
// router
//   .route("/mylives")
//   .get(
//     authServices.protect,
//     authServices.allowedTo("user"),
//     liveService.createFilterObj,
//     liveService.getLives
//   );

module.exports = router;
