import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import { ImageProcessingService } from '../common/upload/image-processing.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogReorderService } from './catalog-reorder.service';

@Injectable()
export class LearningCatalogService {
  constructor(
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    private readonly query: CatalogQueryService,
    private readonly reorder: CatalogReorderService,
    private readonly images: ImageProcessingService,
  ) {}

  async getPackages(query: Record<string, any>, user?: any, adminList = false) {
    let filter: Record<string, any> = adminList || query.all || user?.role === 'admin' ? {} : { status: 'active' };
    if (adminList && user?.role !== 'admin') {
      const instructorCourses = await this.courseModel
        .find({ instructor: user._id })
        .select('_id')
        .setOptions({ skipPopulate: true })
        .lean();
      filter.course = { $in: instructorCourses.map((course: any) => course._id) };
    }
    filter = this.query.applyCatalogFilters(query, filter, Boolean(adminList || query.all || user?.role === 'admin' || user?.isInstructor));
    return this.query.list(this.packageModel, query, 'Package', filter);
  }

  async getPackage(id: string) {
    const document = await this.findByIdOrSlug(this.packageModel, id);
    return { data: document };
  }

  async createPackage(body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.packageModel, body, user, file, 'packages', 'package');
    return { data: await this.packageModel.create(payload) };
  }

  async updatePackage(id: string, body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.packageModel, body, user, file, 'packages', 'package', false);
    const document = await this.packageModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!document) throw new NotFoundException(`No document For this id ${id}`);
    return { data: document };
  }

  async deletePackage(id: string) {
    const document = await this.packageModel.findByIdAndDelete(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  getPackageReorderItems() {
    return this.reorder.getReorderItems(this.packageModel);
  }

  updatePackageOrder(items: { id: string; order: number }[]) {
    return this.reorder.updateItemsOrder(this.packageModel, items);
  }

  async getCoursePackages(query: Record<string, any>, user?: any, adminList = false) {
    let filter: Record<string, any> = adminList ? {} : { status: 'active' };
    if (adminList && user?.role !== 'admin' && user?.isInstructor) {
      const courses = await this.courseModel.find({ instructor: user._id }).select('_id').setOptions({ skipPopulate: true });
      if (courses.length === 0) return { results: 0, data: [] };
      filter = {
        $or: [
          { instructor: user._id },
          { courses: { $in: courses.map((course: any) => course._id) } },
        ],
      };
    }
    filter = this.query.applyCatalogFilters(query, filter, Boolean(adminList && (user?.role === 'admin' || user?.isInstructor)));
    return this.query.list(this.coursePackageModel, query, 'CoursePackage', filter);
  }

  async getCoursePackage(id: string) {
    const document = await this.findByIdOrSlug(this.coursePackageModel, id);
    return { data: document };
  }

  async createCoursePackage(body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.coursePackageModel, body, user, file, 'coursePackages', 'coursePackage');
    return { data: await this.coursePackageModel.create(payload) };
  }

  async updateCoursePackage(id: string, body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.coursePackageModel, body, user, file, 'coursePackages', 'coursePackage', false);
    const document = await this.coursePackageModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!document) throw new NotFoundException(`No document For this id ${id}`);
    return { data: document };
  }

  async deleteCoursePackage(id: string) {
    const document = await this.coursePackageModel.findByIdAndDelete(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  getCoursePackageReorderItems() {
    return this.reorder.getReorderItems(this.coursePackageModel);
  }

  updateCoursePackageOrder(items: { id: string; order: number }[]) {
    return this.reorder.updateItemsOrder(this.coursePackageModel, items);
  }

  private async prepareCatalogPayload(
    model: Model<any>,
    body: Record<string, any>,
    user: any,
    file: Express.Multer.File | undefined,
    folder: string,
    prefix: string,
    assignOrder = true,
  ) {
    let payload = { ...body };
    this.convertArrayFields(payload);
    if (!payload.instructor) payload.instructor = user._id;
    if (payload.title?.en) payload.slug = slugify(payload.title.en);
    if (file) payload.image = await this.images.saveImageAsWebp(file, folder, prefix, 95);
    if (assignOrder) payload = await this.reorder.assignNextOrder(model, payload);
    return payload;
  }

  private convertArrayFields(payload: Record<string, any>) {
    ['highlights', 'whatWillLearn', 'coursePrerequisites', 'whoThisCourseFor', 'courses'].forEach((field) => {
      if (payload[field] && !Array.isArray(payload[field])) payload[field] = [payload[field]];
    });
  }

  private async findByIdOrSlug(model: Model<any>, id: string) {
    const document = Types.ObjectId.isValid(id) ? await model.findById(id) : await model.findOne({ slug: id });
    if (!document) throw new NotFoundException(`No document found for: ${id}`);
    return document;
  }
}
