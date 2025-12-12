class ApiFeatures {
  constructor(mongooseQuery, queryStr) {
    this.mongooseQuery = mongooseQuery;
    this.queryStr = queryStr;
  }

  filter() {
    // Filter is already applied in handllerFactory.js via Model.find(filter)
    // This method is kept for backward compatibility but doesn't need to do anything
    // since the query is already created with the filter conditions
    return this;
  }

  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split('.').join(' ');
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryStr.fields) {
      const fields = this.queryStr.fields.split(',').join(' ');
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select('-__v');
    }
    return this;
  }

  search(modelName) {
    if (this.queryStr.keyword) {
      let searchQuery = {};
      if (modelName === 'User') {
        searchQuery = {
          name: { $regex: this.queryStr.keyword, $options: 'i' },
        };
      } else if (modelName === 'Notification') {
        searchQuery.$or = [
          { 'message.ar': { $regex: this.queryStr.keyword, $options: 'i' } },
          { 'message.en': { $regex: this.queryStr.keyword, $options: 'i' } },
        ];
      } else if (modelName === 'Analytic') {
        searchQuery = {
          content: { $regex: this.queryStr.keyword, $options: 'i' },
        };
      } else {
        // Default search for models with title/description
        searchQuery.$or = [
          { 'title.ar': { $regex: this.queryStr.keyword, $options: 'i' } },
          { 'title.en': { $regex: this.queryStr.keyword, $options: 'i' } },
          {
            'description.ar': { $regex: this.queryStr.keyword, $options: 'i' },
          },
          {
            'description.en': { $regex: this.queryStr.keyword, $options: 'i' },
          },
        ];
      }
      // Use and() to merge search conditions with existing query conditions
      this.mongooseQuery = this.mongooseQuery.and([searchQuery]);
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryStr.page, 10) || 1;
    const limit = parseInt(this.queryStr.limit, 10) || 50;
    const startIndex = (page - 1) * limit;

    this.mongooseQuery = this.mongooseQuery.skip(startIndex).limit(limit);

    return this.mongooseQuery.exec(); // Execute and return the query promise
  }
}

module.exports = ApiFeatures;
