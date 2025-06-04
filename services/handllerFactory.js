const ApiError = require("../utils/apiError");
const ApiFeatures = require("../utils/apiFeatures");

exports.updateOne = (Model) => async (req, res, next) => {
  try {
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!document) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "document" }), 404)
      );
    }
    res.status(200).json({ status: `updated successfully`, data: document });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createOne = (Model) => async (req, res) => {
  try {
    const document = await Model.create(req.body);
    return res
      .status(201)
      .json({ status: `created successfully`, data: document });
  } catch (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getOne = (Model, populationOpt) => async (req, res, next) => {
  try {
    const { id } = req.params;
    //1-build query
    let query = Model.findById(id);
    if (populationOpt) {
      query = query.populate(populationOpt);
    }
    //2- excute query
    const document = await query;

    if (!document) {
      return next(new ApiError(`No document For this id ${id}`, 404));
    }
    const { title } = document;
    const localizedResult = Model.schema.methods.toJSONLocalizedOnly(
      document,
      req.locale
    );
    localizedResult.translationTitle = title;
    if (document.description) {
      localizedResult.translationDescription = document.description;
    }
    if (document.highlights) {
      localizedResult.translationHighlights = document.highlights;
    }
    if (document.content) {
      localizedResult.translationContent = document.content;
    }

    return res.status(200).json({ data: localizedResult });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getALl =
  (Model, modelName = "", populationOpt) =>
  async (req, res) => {
    try {
      let filter = {};
      if (req.filterObj) {
        filter = req.filterObj;
      }

      let query = Model.find(filter);

      if (populationOpt) {
        query = query.populate(populationOpt);
      }

      // check is filter is empty
      if (Object.keys(filter).length === 0) {
        const excludesFields = ["page", "sort", "limit", "fields"];
        //get all Fields except these
        const queryObj = { ...req.query };
        excludesFields.forEach((field) => delete queryObj[field]);
        filter = { ...queryObj };
      }

      const documentsCount = await Model.countDocuments(filter);

      const apiFeatures = new ApiFeatures(query, req.query)
        .filter()
        .search(modelName)
        .sort()
        .limitFields();

      const results = await apiFeatures.paginate();

      const localizedResult = Model.schema.methods.toJSONLocalizedOnly(
        results,
        req.locale
      );

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
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Internal server error" });
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
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
