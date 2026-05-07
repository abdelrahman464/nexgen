import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';

@Injectable()
export class CatalogQueryService {
  async list(model: Model<any>, query: Record<string, any>, modelName: string, filter: Record<string, any> = {}) {
    const computedFilter = Object.keys(filter).length ? filter : this.filterFromQuery(query);
    const totalCount = await model.countDocuments(computedFilter);
    const data = await new ApiQueryHelper(model.find(computedFilter), query, 'order -createdAt')
      .search(modelName)
      .sort()
      .limitFields()
      .paginate();
    const currentPage = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 50;
    const numberOfPages = Math.ceil(totalCount / limit);
    return {
      results: data.length,
      paginationResult: {
        totalCount,
        currentPage,
        limit,
        numberOfPages,
        nextPage: currentPage < numberOfPages ? currentPage + 1 : null,
      },
      data,
    };
  }

  filterFromQuery(query: Record<string, any>) {
    const filter = { ...query };
    ['page', 'sort', 'limit', 'fields', 'keyword', 'all'].forEach((key) => delete filter[key]);
    return filter;
  }

  applyCatalogFilters(query: Record<string, any>, filter: Record<string, any> = {}, canUseStatus = false) {
    const nextFilter = { ...filter };
    const { title, description, keyword, category, status } = query;
    const orFilters: Record<string, any>[] = [];
    if (category) nextFilter.category = category;
    if (status && canUseStatus) nextFilter.status = status;
    if (keyword) {
      const textPattern = new RegExp(keyword, 'i');
      orFilters.push(
        { 'title.ar': { $regex: textPattern } },
        { 'title.en': { $regex: textPattern } },
        { 'description.ar': { $regex: textPattern } },
        { 'description.en': { $regex: textPattern } },
      );
    }
    if (title) orFilters.push({ 'title.ar': title }, { 'title.en': title });
    if (description) orFilters.push({ 'description.ar': description }, { 'description.en': description });
    if (orFilters.length) nextFilter.$or = [...(nextFilter.$or || []), ...orFilters];
    return nextFilter;
  }
}
