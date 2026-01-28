const ApiError = require('../utils/apiError');
const ApiFeatures = require('../utils/apiFeatures');
const { addTranslationFields } = require('../helpers/courseHelper');

// True only for a standard MongoDB ObjectId string (24 hex chars)
function IsMongoId(id) {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
}

exports.updateOne = (Model) => async (req, res, next) => {
  try {
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!document) {
      return next(
        new ApiError(res.__('errors.Not-Found', { document: 'document' }), 404),
      );
    }
    const localizedDocument = Model.schema.methods.toJSONLocalizedOnly(
      document,
      req.locale,
    );
    res
      .status(200)
      .json({ status: `updated successfully`, data: localizedDocument });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createOne = (Model) => async (req, res) => {
  try {
    const document = await Model.create(req.body);
    const localizedDocument = Model.schema.methods.toJSONLocalizedOnly(
      document,
      req.locale,
    );
    return res
      .status(201)
      .json({ status: `created successfully`, data: localizedDocument });
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getOne = (Model, populationOpt) => async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1 - Build query
    let query;

    // More strict ObjectId validation (must be exactly 24 hex characters)
    if (IsMongoId(id)) {
      query = Model.findById(id);
    } else {
      query = Model.findOne({ slug: id });
    }

    if (populationOpt) {
      query = query.populate(populationOpt);
    }

    // 2 - Execute query
    const document = await query;

    if (!document) {
      return next(new ApiError(`No document found for: ${id}`, 404));
    }

    const localizedResult = Model.schema.methods.toJSONLocalized(
      document,
      req.locale,
    );

    return res.status(200).json({ data: localizedResult });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get one document by slug.
 * @param {Model} Model - Mongoose model (must have a `slug` field)
 * @param {string|string[]|object|object[]} populationOpt - Optional populate path(s). Single path string, or array of paths/options for multiple populates
 */
exports.getOneBySlug = (Model, populationOpt) => async (req, res, next) => {
  try {
    const { slug } = req.params;
    let query = Model.findOne({ slug });
    if (populationOpt) {
      if (Array.isArray(populationOpt)) {
        populationOpt.forEach((opt) => {
          query = query.populate(opt);
        });
      } else {
        query = query.populate(populationOpt);
      }
    }
    const document = await query;

    if (!document) {
      return next(
        new ApiError(
          res.__?.('errors.Not-Found', { document: 'document' }) ||
            `No document found for this slug ${slug}`,
          404,
        ),
      );
    }

    const localizedResult = Model.schema.methods.toJSONLocalized(
      document,
      req.locale,
    );
    return res.status(200).json({ status: 'success', data: localizedResult });
  } catch (error) {
    console.error('Error fetching document by slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getALl =
  (Model, modelName = '', populationOpt) =>
  async (req, res) => {
    try {
      let filter = {};

      // Apply initial filter if exists
      if (req.filterObj) {
        filter = req.filterObj;
      }

      // If no initial filter, build from query params
      if (Object.keys(filter).length === 0) {
        const excludesFields = ['page', 'sort', 'limit', 'fields', 'keyword'];
        const queryObj = { ...req.query };
        excludesFields.forEach((field) => delete queryObj[field]);
        filter = { ...queryObj };
      }

      // Count documents with the filter
      const documentsCount = await Model.countDocuments(filter);

      // Build initial query with filter and population
      let query = Model.find(filter);
      if (populationOpt) {
        query = query.populate(populationOpt);
      }

      // Apply API features
      const apiFeatures = new ApiFeatures(query, req.query)
        .filter()
        .search(modelName)
        .sort()
        .limitFields();

      // Get paginated results
      const results = await apiFeatures.paginate();
      // Apply localization if method exists
      let localizedResult = results;
      if (Model.schema.methods && Model.schema.methods.toJSONLocalizedOnly) {
        localizedResult = Model.schema.methods.toJSONLocalizedOnly(
          results,
          req.locale,
        );
      }

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
        data: localizedResult,
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  };

exports.deleteOne = (Model) => async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Model.findByIdAndDelete(id);
    if (!document) {
      return next(new ApiError(`No document for this id ${id}`, 404));
    }
    // Trigger "remove" event when delete document
    document.remove();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
