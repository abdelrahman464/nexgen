import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import mongoose, { Model } from 'mongoose';
import { ApiException } from '../common/exceptions/api.exception';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { ImageProcessingService } from '../common/upload/image-processing.service';

const Order = require('../../models/orderModel');
const Message = require('../../models/MessageModel');
const Chat = require('../../models/ChatModel');
const Notification = require('../../models/notificationModel');
const ReactModel = require('../../models/reactionModel');
const Comment = require('../../models/commentModel');
const CourseProgress = require('../../models/courseProgressModel');
const MarketLog = require('../../models/MarketingModel');
const Course = require('../../models/courseModel');
const Article = require('../../models/articalModel');
const Package = require('../../models/packageModel');
const CoursePackage = require('../../models/coursePackageModel');
const Live = require('../../models/liveModel');

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly images: ImageProcessingService,
  ) {}

  async listUsers(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.listDocuments(this.userModel, query, 'User', filter);
  }

  listInstructors(query: Record<string, any>) {
    return this.listUsers(query, { isInstructor: true });
  }

  listAdminsAndInstructors(query: Record<string, any>) {
    return this.listUsers(query, { $or: [{ isInstructor: true }, { role: 'admin' }] });
  }

  async getUser(id: string, currentUser: any) {
    const query =
      currentUser.role === 'admin'
        ? this.userModel.findById(id)
        : this.userModel
            .findById(id)
            .select('name email profileImg authToReview bio coverImg role timeSpent isMarketer isInstructor isCustomerService startMarketing idNumber phone country idVerification note signatureImage');
    const user = await query;
    if (!user) throw new NotFoundException('No user found');
    return { data: user };
  }

  async createUser(body: any, files?: UserUploadFiles) {
    const payload = await this.withUploadedImages({ ...body }, files);
    delete payload.passwordConfirm;
    await this.assertEmailAvailable(payload.email);
    return { status: 'created successfully', data: await this.userModel.create(payload) };
  }

  async updateUser(id: string, body: any, files?: UserUploadFiles) {
    const payload = await this.withUploadedImages({ ...body }, files);
    delete payload.password;
    delete payload.passwordConfirm;
    if (payload.email) await this.assertEmailAvailable(payload.email, id);
    const user = await this.userModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!user) throw new NotFoundException(`No document For this id ${id}`);
    return { status: 'updated successfully', data: user };
  }

  async changeUserPassword(id: string, body: any) {
    const user = await this.userModel.findById(id).select('+password');
    if (!user) throw new NotFoundException(`No document For this id ${id}`);
    if (!(await bcrypt.compare(body.currentPassword, user.password))) {
      throw new ApiException('Incorrect current password', 401);
    }
    user.password = body.password;
    user.passwordChangedAt = Date.now();
    await user.save({ validateBeforeSave: false });
    return { data: user };
  }

  async deleteUser(id: string) {
    await mongoose.connection
      .transaction(async (session) => {
        const user = await this.userModel.findByIdAndDelete(id).session(session);
        if (!user) throw new NotFoundException(`User not found for this id ${id}`);
        await Promise.all([
          Order.deleteMany({ user: user._id }).session(session),
          Message.deleteMany({ sender: user._id }).session(session),
          Notification.deleteMany({ user: user._id }).session(session),
          ReactModel.deleteMany({ user: user._id }).session(session),
          Comment.deleteMany({ user: user._id }).session(session),
          CourseProgress.deleteMany({ user: user._id }).session(session),
          MarketLog.deleteOne({ marketer: user._id }).session(session),
          Chat.updateMany(
            { 'participants.user': user._id, isGroupChat: true },
            { $pull: { participants: { user: user._id } } },
          ).session(session),
          Chat.deleteMany({ 'participants.user': user._id, isGroupChat: false }).session(session),
        ]);
      })
      .catch((error: unknown) => {
        if (error instanceof NotFoundException) throw error;
        console.error('Transaction error:', error);
        throw new ApiException('Error during transaction', 500);
      });
    return undefined;
  }

  async updateLoggedUserPassword(user: any, body: any, generateToken: (id: string) => string) {
    const freshUser = await this.userModel.findById(user._id).select('+password');
    if (!freshUser) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(body.currentPassword, freshUser.password))) {
      throw new ApiException('Incorrect current password', 401);
    }
    freshUser.password = body.password;
    freshUser.passwordChangedAt = Date.now();
    await freshUser.save({ validateBeforeSave: false });
    return { data: freshUser, token: generateToken(String(user._id)) };
  }

  async updateLoggedUserData(user: any, body: any, files?: UserUploadFiles) {
    const currentUser = await this.userModel.findById(user._id);
    if (!currentUser) throw new NotFoundException('User not found');

    const payload = await this.withUploadedImages(
      {
        profileImg: body.profileImg,
        coverImg: body.coverImg,
        signatureImage: body.signatureImage,
        bio: body.bio,
        lang: body.lang,
      },
      files,
    );

    if (!currentUser.country && body.country) payload.country = body.country;
    if (!currentUser.phone && body.phone) payload.phone = body.phone;

    const updatedUser = await this.userModel.findByIdAndUpdate(user._id, payload, { new: true });
    return { data: updatedUser };
  }

  async setActive(id: string, active: boolean) {
    await this.userModel.findByIdAndUpdate(id, { active });
    if (active) return { data: 'success' };
    return undefined;
  }

  async moveOneUserToAnother(body: Record<string, any>) {
    const user = await this.userModel.findById(body.user);
    if (!user) throw new NotFoundException('No user found for this id');
    if (user.invitor) await this.moveOrdersFromOneToOne(user.invitor, body.newInvitor, user._id);
    else {
      const invitorExists = await this.userModel.exists({ _id: body.newInvitor });
      if (!invitorExists) throw new NotFoundException('No invitor found');
    }
    user.invitor = body.newInvitor;
    await user.save();
    return { status: 'success', msg: 'mission done' };
  }

  async queryEmailMarketingUsers(body: Record<string, any>) {
    const page = Math.max(Number.parseInt(body.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(body.limit, 10) || 50, 1), 10000);
    const skip = (page - 1) * limit;
    const compiledQuery = this.compileEmailMarketingQuery(
      body.query || { type: 'group', operator: 'AND', children: [] },
      new Date(),
    );
    const [aggregationResult] = await this.userModel.aggregate([
      { $match: { role: { $nin: ['admin', 'campaign'] } } },
      { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'userOrders' } },
      { $lookup: { from: 'courseprogresses', localField: '_id', foreignField: 'user', as: 'courseProgress' } },
      { $lookup: { from: 'usersubscriptions', localField: '_id', foreignField: 'user', as: 'userSubscriptions' } },
      { $match: { $expr: compiledQuery } },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                country: 1,
                role: 1,
                isInstructor: 1,
                isMarketer: 1,
                active: 1,
                emailVerified: 1,
                idVerification: 1,
                idDocuments: 1,
                createdAt: 1,
                updatedAt: 1,
                profileImg: {
                  $cond: {
                    if: { $and: [{ $ifNull: ['$profileImg', false] }, { $ne: ['$profileImg', ''] }] },
                    then: { $concat: [process.env.BASE_URL, '/users/', '$profileImg'] },
                    else: null,
                  },
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const data = aggregationResult?.data || [];
    const totalCount = aggregationResult?.total?.[0]?.count || 0;
    return {
      success: true,
      results: data.length,
      paginationResult: { totalCount, currentPage: page, limit, numberOfPages: Math.ceil(totalCount / limit) },
      data,
    };
  }

  async getAllInstructorsWithBelongings() {
    const instructors = await this.userModel.find({ isInstructor: true }).select('name email profileImg bio');
    const instructorsWithBelongings = await Promise.all(
      instructors.map(async (instructor: any) => {
        const courses = await Course.find({ instructor: instructor._id });
        const activeCoursesCount = courses.filter((course: any) => course.status === 'active').length;
        const courseIds = courses.map((course: any) => course._id);
        const [packages, coursePackages, orders, articles, liveSessions] = await Promise.all([
          Package.find({ course: { $in: courseIds } }),
          CoursePackage.find({ courses: { $in: courseIds } }),
          Order.find({ course: { $in: courseIds } }),
          Article.find({ author: instructor._id }),
          Live.find({ instructor: instructor._id }),
        ]);
        return {
          instructor: {
            _id: instructor._id,
            name: instructor.name,
            email: instructor.email,
            profileImg: instructor.profileImg,
            bio: instructor.bio,
          },
          belongings: {
            courses: { total: courses.length, active: activeCoursesCount, inactive: courses.length - activeCoursesCount, list: courses },
            packages: { total: packages.length, list: packages },
            coursePackages: { total: coursePackages.length, list: coursePackages },
            orders: { total: orders.length, list: orders },
            articles: { total: articles.length, list: articles },
            liveSessions: { total: liveSessions.length, list: liveSessions },
          },
          activeCoursesCount,
        };
      }),
    );
    instructorsWithBelongings.sort((a, b) => b.activeCoursesCount - a.activeCoursesCount);
    const data = instructorsWithBelongings.map(({ activeCoursesCount, ...rest }) => rest);
    return { status: 'success', results: data.length, data };
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async assertEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.userModel.findOne({ email });
    if (existing && existing._id.toString() !== excludeId) {
      throw new ApiException('E-mail already in use', 400);
    }
  }

  async withUploadedImages(body: Record<string, any>, files?: UserUploadFiles) {
    if (files?.profileImg?.[0]) {
      body.profileImg = await this.images.saveImageAsWebp(files.profileImg[0], 'users', 'profileImg', 95);
    }
    if (files?.coverImg?.[0]) {
      body.coverImg = await this.images.saveImageAsWebp(files.coverImg[0], 'users', 'coverImg', 95);
    }
    if (files?.signatureImage?.[0]) {
      body.signatureImage = await this.images.saveImageAsWebp(files.signatureImage[0], 'users', 'signatureImage', 95);
    }
    if (files?.idDocuments?.length) {
      body.idDocuments = await this.images.saveManyImagesAsWebp(files.idDocuments, 'users/idDocuments', 'idDocuments', 95);
    }
    return body;
  }

  private async listDocuments(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}) {
    const computedFilter = Object.keys(filter).length ? filter : this.filterFromQuery(query);
    const totalCount = await model.countDocuments(computedFilter);
    const data = await new ApiQueryHelper(model.find(computedFilter), query, '-createdAt')
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

  private filterFromQuery(query: Record<string, any>) {
    const filter = { ...query };
    ['page', 'sort', 'limit', 'fields', 'keyword'].forEach((key) => delete filter[key]);
    return filter;
  }

  private async moveOrdersFromOneToOne(exporter: string, importer: string, userId: string) {
    const exporterLog = await MarketLog.findOne({ marketer: exporter, sales: { $exists: true, $not: { $size: 0 } } });
    if (!exporterLog) return 'No orders found';
    const importerLog = await MarketLog.findOne({ marketer: importer });
    if (!importerLog) return 'No importer found';
    const userOrders = exporterLog.sales.filter((sale: any) => sale.purchaser.toString() === userId.toString());
    exporterLog.sales = exporterLog.sales.filter((sale: any) => sale.purchaser.toString() !== userId.toString());
    importerLog.sales.push(...userOrders);
    const totalOrderMoney = userOrders.reduce((acc: number, order: any) => acc + order.amount, 0);
    importerLog.totalSalesMoney += totalOrderMoney;
    importerLog.profitPercentage = this.detectPercentage(importerLog.role, importerLog.totalSalesMoney);
    importerLog.profits = (importerLog.totalSalesMoney * importerLog.profitPercentage) / 100;
    await Promise.all([importerLog.save(), exporterLog.save()]);
    return true;
  }

  private compileEmailMarketingQuery(node: any, now: Date, depth = 0, counter = { count: 0 }): any {
    if (!node || typeof node !== 'object') throw new BadRequestException('Email marketing query node is required');
    counter.count += 1;
    if (counter.count > 100) throw new BadRequestException('Email marketing query is too large');
    if (depth > 5) throw new BadRequestException('Email marketing query is too deeply nested');
    if (node.type === 'condition') return this.compileEmailMarketingCondition(node, now);
    if (node.type === 'not') {
      if (!node.child) throw new BadRequestException('NOT query node requires a child');
      return { $not: [this.compileEmailMarketingQuery(node.child, now, depth + 1, counter)] };
    }
    if (node.type !== 'group') throw new BadRequestException(`Unsupported email marketing query node: ${node.type}`);
    if (!['AND', 'OR'].includes(node.operator)) throw new BadRequestException('Email marketing group operator must be AND or OR');
    if (!Array.isArray(node.children)) throw new BadRequestException('Email marketing group children must be an array');
    if (node.children.length === 0) return { $eq: [1, 1] };
    const children = node.children.map((child: any) => this.compileEmailMarketingQuery(child, now, depth + 1, counter));
    return node.operator === 'AND' ? { $and: children } : { $or: children };
  }

  private compileEmailMarketingCondition(node: any, now: Date) {
    const conditionType = node.conditionType || node.condition || node.field || '';
    if (!conditionType) throw new BadRequestException('Email marketing condition type is required');
    if (conditionType === 'hasPaidOrder') return this.arrayHasMatch('$userOrders', 'order', { $eq: ['$$order.isPaid', true] });
    const value = node.value || node.itemId || node.courseId || node.coursePackageId || node.packageId;
    const withId = new Set(['boughtCourse', 'ownsCourse', 'boughtCoursePackage', 'boughtService', 'hadServiceSubscription', 'hasActiveServiceSubscription']);
    if (!withId.has(conditionType)) throw new BadRequestException(`Unsupported email marketing condition: ${conditionType}`);
    if (!mongoose.Types.ObjectId.isValid(value)) throw new BadRequestException(`Invalid item id for condition: ${conditionType}`);
    const itemId = new mongoose.Types.ObjectId(value);
    if (conditionType === 'boughtCourse') return this.arrayHasMatch('$userOrders', 'order', { $and: [{ $eq: ['$$order.isPaid', true] }, { $eq: ['$$order.course', itemId] }] });
    if (conditionType === 'ownsCourse') return this.arrayHasMatch('$courseProgress', 'progress', { $eq: ['$$progress.course', itemId] });
    if (conditionType === 'boughtCoursePackage') return this.arrayHasMatch('$userOrders', 'order', { $and: [{ $eq: ['$$order.isPaid', true] }, { $eq: ['$$order.coursePackage', itemId] }] });
    if (conditionType === 'boughtService') return this.arrayHasMatch('$userOrders', 'order', { $and: [{ $eq: ['$$order.isPaid', true] }, { $eq: ['$$order.package', itemId] }] });
    if (conditionType === 'hadServiceSubscription') return this.arrayHasMatch('$userSubscriptions', 'subscription', { $eq: ['$$subscription.package', itemId] });
    return this.arrayHasMatch('$userSubscriptions', 'subscription', { $and: [{ $eq: ['$$subscription.package', itemId] }, { $gte: ['$$subscription.endDate', now] }] });
  }

  private arrayHasMatch(input: string, variableName: string, cond: Record<string, any>) {
    return { $gt: [{ $size: { $filter: { input, as: variableName, cond } } }, 0] };
  }

  private detectPercentage(role: string, totalSalesMoney: number) {
    if (role === 'head') {
      if (totalSalesMoney < 1000) return 20;
      if (totalSalesMoney < 2000) return 30;
      if (totalSalesMoney < 3000) return 40;
      return 50;
    }
    if (totalSalesMoney < 1000) return 15;
    if (totalSalesMoney < 2000) return 20;
    return 30;
  }
}

export type UserUploadFiles = {
  profileImg?: Express.Multer.File[];
  coverImg?: Express.Multer.File[];
  signatureImage?: Express.Multer.File[];
  idDocuments?: Express.Multer.File[];
};
