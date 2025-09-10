const Category = require("../models/categoryModel");
const Course = require("../models/courseModel");
const factory = require("./handllerFactory");
const ApiFeatures = require("../utils/apiFeatures");

//@desc get list of categories
//@route GET /api/v1/categories
//@access public
// exports.getCategories = factory.getALl(Category, "Category");
exports.getCategories = async (req, res) => {
  try {
    let filter = {};

    // Apply initial filter if exists
    if (req.filterObj) {
      filter = req.filterObj;
    }

    // If no initial filter, build from query params
    if (Object.keys(filter).length === 0) {
      const excludesFields = ["page", "sort", "limit", "fields"];
      const queryObj = { ...req.query };
      excludesFields.forEach((field) => delete queryObj[field]);
      filter = { ...queryObj };
    }

    // Count documents with the filter
    const documentsCount = await Category.countDocuments(filter);

    // Build initial query with filter and population
    const query = Category.find(filter);

    // Apply API features
    const apiFeatures = new ApiFeatures(query, req.query)
      .filter()
      .search("Category")
      .sort()
      .limitFields();

    // Get paginated results
    const results = await apiFeatures.paginate();

    // Apply localization if method exists
    let localizedResult = results;
    if (
      Category.schema.methods &&
      Category.schema.methods.toJSONLocalizedOnly
    ) {
      localizedResult = Category.schema.methods.toJSONLocalizedOnly(
        results,
        req.locale
      );
    }
    //attach coursecount to each category
    const categoriesWithCourseCount = await Promise.all(
      localizedResult.map(async (category) => {
        const courseCount = await Course.countDocuments({
          category: category._id,
          status: "active", // Only count active courses
        });
        return {
          ...(category.toObject ? category.toObject() : category),
          courseCount,
        };
      })
    );

    // Calculate pagination
    const currentPage = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const numberOfPages = Math.ceil(documentsCount / limit);
    let nextPage = null;

    if (currentPage < numberOfPages) {
      nextPage = currentPage + 1;
    }

    return res.status(200).json({
      results: results.length,
      paginationResult: {
        totalCount: documentsCount,
        currentPage,
        limit,
        numberOfPages,
        nextPage,
      },
      data: categoriesWithCourseCount,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
//@desc get specific category by id
//@route GET /api/v1/categories/:id
//@access public
exports.getCategory = factory.getOne(Category);

//@desc create category
//@route POST /api/v1/categories
//@access private
exports.createCategory = factory.createOne(Category);

//@desc update specific category
//@route PUT /api/v1/categories/:id
//@access private
exports.updateCategory = factory.updateOne(Category);
