import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';

const User = require('../../models/userModel');
const { checkCourseAccess } = require('../../utils/validators/courseValidator');

@Injectable()
export class CommerceAccessService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
  ) {}

  async listOrders(query: Record<string, any>, user: any) {
    const { filter, cleanedQuery } = this.buildOrderFilter(query, user);
    if (query.userId && user.role !== 'admin') {
      const isUserExist = await User.exists({ _id: query.userId, invitor: user._id });
      if (!isUserExist) throw new ForbiddenException("You are not authorized to view this user's orders");
    }

    const totalCount = await this.orderModel.countDocuments(filter);
    const data = await new ApiQueryHelper(this.orderModel.find(filter), cleanedQuery, '-createdAt')
      .search('Order')
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

  async assertNoRecentPaidOrder(userId: string) {
    const orders = await this.orderModel.find({
      user: userId,
      isPaid: true,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (!orders.length) return;
    const lastOrderTime = orders[0].createdAt.getTime();
    const nextAllowedTime = new Date(lastOrderTime + 60 * 60 * 1000);
    const remainingTime = Math.max(0, nextAllowedTime.getTime() - Date.now());
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    throw new ForbiddenException(
      `You have already placed an order within the past hour. Please wait ${minutes} minutes and ${seconds} seconds to place another order.`,
    );
  }

  async assertCourseCanBePurchased(user: any, courseId: string) {
    await checkCourseAccess(user, courseId);
    const existOrder = await this.orderModel.findOne({ user: user._id, course: courseId });
    if (existOrder) throw new ForbiddenException('You already bought this course');
  }

  getModelForType(type: 'course' | 'package' | 'coursePackage') {
    if (type === 'course') return this.courseModel;
    if (type === 'package') return this.packageModel;
    return this.coursePackageModel;
  }

  private buildOrderFilter(query: Record<string, any>, user: any) {
    const filter: Record<string, any> = {};
    const cleanedQuery = { ...query };

    if (query.userId) {
      filter.user = query.userId;
      delete cleanedQuery.userId;
    } else if (user.role === 'user') {
      filter.user = user._id;
    }

    if (query.startDate && query.endDate) {
      filter.paidAt = { $gte: new Date(query.startDate), $lte: new Date(query.endDate) };
      delete cleanedQuery.startDate;
      delete cleanedQuery.endDate;
    } else if (query.day) {
      const dayStart = new Date(query.day);
      const dayEnd = new Date(query.day);
      dayEnd.setUTCHours(23, 59, 59, 999);
      filter.paidAt = { $gte: dayStart, $lte: dayEnd };
      delete cleanedQuery.day;
    }

    return { filter, cleanedQuery };
  }
}
