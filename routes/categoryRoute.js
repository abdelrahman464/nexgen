const express = require("express");

const {
  getCategoryValidator,
  createCategroyValidator,
  updateCategroyValidator,
  deleteCategroyValidator,
} = require("../utils/validators/categoryValidator");
const {
  getCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
} = require("../services/categoryService");

const authServices = require("../services/authServices");

const courseRoute = require("./courseRoute");

const router = express.Router();

router.use("/:categoryId/courses", courseRoute);

router
  .route("/")
  .get(getCategories)
  .post(
    authServices.protect,
    authServices.allowedTo("admin"),
    createCategroyValidator,
    createCategory
  );
router
  .route("/:id")
  .get(getCategoryValidator, getCategory)
  .put(
    authServices.protect,
    authServices.allowedTo("admin"),
    updateCategroyValidator,
    updateCategory
  )
  .delete(
    authServices.protect,
    authServices.allowedTo("admin"),
    deleteCategroyValidator,
    deleteCategory
  );

module.exports = router;
