const ApiError = require('../utils/apiError');
const ApiFeatures = require('../utils/apiFeatures');

exports.updateOne = (Model) => async (req, res, next) => {
  try {
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!document) {
      return next(
        new ApiError(`No document For this id ${req.params.id}`, 404),
      );
    }
    res.status(200).json({ data: document });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createOne = (Model) => async (req, res) => {
  try {
    const document = await Model.create(req.body);
    res.status(201).json({ data: document });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(200).json({ data: document });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// eslint-disable-next-line default-param-last
exports.getALl =
  (Model, modelName = '', populationOpt) =>
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

      const documentsCount = await Model.countDocuments(filter);

      const apiFeatures = new ApiFeatures(query, req.query)
        .filter()
        .search(modelName)
        .sort()
        .limitFields();

      const results = await apiFeatures.paginate();

      const currentPage = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const numberOfPages = Math.ceil(documentsCount / limit);
      let nextPage = null;

      if (currentPage < numberOfPages) {
        nextPage = currentPage + 1;
      }

      res.status(200).json({
        results: results.length,
        paginationResult: {
          totalCount: documentsCount,
          currentPage,
          limit,
          numberOfPages,
          nextPage,
        },
        data: results,
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Internal server error' });
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
