type QueryParams = Record<string, any>;

export class ApiQueryHelper {
  constructor(
    private mongooseQuery: any,
    private readonly query: QueryParams,
    private readonly defaultSort = '-createdAt',
  ) {}

  search(modelName: string) {
    const keyword = this.query.keyword;
    if (!keyword) return this;
    let searchQuery: Record<string, unknown> = {};
    if (modelName === 'User') {
      searchQuery = { name: { $regex: keyword, $options: 'i' } };
    } else if (modelName === 'Notification') {
      searchQuery.$or = [
        { 'message.ar': { $regex: keyword, $options: 'i' } },
        { 'message.en': { $regex: keyword, $options: 'i' } },
      ];
    } else if (modelName === 'Analytic') {
      searchQuery = { content: { $regex: keyword, $options: 'i' } };
    } else {
      searchQuery.$or = [
        { 'title.ar': { $regex: keyword, $options: 'i' } },
        { 'title.en': { $regex: keyword, $options: 'i' } },
        { 'description.ar': { $regex: keyword, $options: 'i' } },
        { 'description.en': { $regex: keyword, $options: 'i' } },
      ];
    }
    this.mongooseQuery = this.mongooseQuery.and([searchQuery]);
    return this;
  }

  sort() {
    const sortBy = this.query.sort ? String(this.query.sort).split(',').join(' ') : this.defaultSort;
    this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    return this;
  }

  limitFields() {
    const fields = this.query.fields ? String(this.query.fields).split(',').join(' ') : '-__v';
    this.mongooseQuery = this.mongooseQuery.select(fields);
    return this;
  }

  paginate() {
    const page = Number.parseInt(this.query.page, 10) || 1;
    const limit = Number.parseInt(this.query.limit, 10) || 50;
    this.mongooseQuery = this.mongooseQuery.skip((page - 1) * limit).limit(limit);
    return this.mongooseQuery.exec();
  }
}
