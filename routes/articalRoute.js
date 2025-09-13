const router = require("express").Router();

const authService = require("../services/authServices");
const {
  uploadImages,
  resizeImages,
  createArtical,
  getAllArticals,
  getOneArtical,
  updateArtical,
  deleteArtical,
  filterActiveArticles,
} = require("../services/articalServices");

const {
  createArticalValidator,
  getOneArticalValidator,
  updateArticalValidator,
  deleteArticalValidator,
} = require("../utils/validators/articalValidator");

router.post(
  "/",
  authService.protect,
  authService.allowedTo("admin"),
  uploadImages,
  resizeImages,
  createArticalValidator,
  createArtical
);
router.get(
  "/getAll",
  authService.protect,
  (req, res, next) => {
    if (req.user.isInstructor) {
      req.filterObj = { instructor: req.user._id };
    }
    next();
  },
  getAllArticals
);

router.get("/", filterActiveArticles, getAllArticals);

router.get("/:id", getOneArticalValidator, getOneArtical);

router.put(
  "/:id",
  authService.protect,
  authService.allowedTo("admin"),
  uploadImages,
  resizeImages,
  updateArticalValidator,
  updateArtical
);

router.delete(
  "/:id",
  authService.protect,
  authService.allowedTo("admin"),
  deleteArticalValidator,
  deleteArtical
);

module.exports = router;
