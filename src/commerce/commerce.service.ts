import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { CommerceAccessService } from './commerce-access.service';
import { CreateUserSubscriptionDto, PurchaseForUserDto } from './dto/commerce.dto';
import { OrderFulfillmentService } from './order-fulfillment.service';

@Injectable()
export class CommerceService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('UserSubscription') private readonly userSubscriptionModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    private readonly access: CommerceAccessService,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

  async getMySubscriptions(query: Record<string, any>, user: any) {
    return this.listDocuments(this.userSubscriptionModel, query, 'UserSubscription', { user: user._id });
  }

  addSubscriber(packageId: string, body: CreateUserSubscriptionDto) {
    return this.fulfillment.addSubscriberToPackage(packageId, body.user);
  }

  purchaseForUser(body: PurchaseForUserDto) {
    return this.fulfillment.purchaseForUser(body.type, body.id, body.userId, body.isPaid);
  }

  createUnPaidOrder(courseId: string, user: any) {
    return this.fulfillment.createUnPaidCourseOrder(courseId, user);
  }

  getOrders(query: Record<string, any>, user: any) {
    return this.access.listOrders(query, user);
  }

  async getOrder(id: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException(`No document for this id ${id}`);
    return { data: order };
  }

  async getOrderStatistics(query: Record<string, any>) {
    const matchStage = this.productMatchStage(query);
    const [overallStats, monthlyStats, paymentMethodStats, dailyStats, recentOrders, productDetails] = await Promise.all([
      this.orderModel.aggregate([{ $match: matchStage }, { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$totalOrderPrice' }, paidOrders: { $sum: { $cond: ['$isPaid', 1, 0] } }, unpaidOrders: { $sum: { $cond: ['$isPaid', 0, 1] } }, resaleOrders: { $sum: { $cond: ['$isResale', 1, 0] } }, averageOrderValue: { $avg: '$totalOrderPrice' } } }]),
      this.orderModel.aggregate([{ $match: { paidAt: { $ne: null }, ...matchStage } }, { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$totalOrderPrice' }, paidOrders: { $sum: { $cond: ['$isPaid', 1, 0] } }, resaleOrders: { $sum: { $cond: ['$isResale', 1, 0] } }, averageOrderValue: { $avg: '$totalOrderPrice' } } }, { $sort: { '_id.year': -1, '_id.month': -1 } }]),
      this.orderModel.aggregate([{ $match: matchStage }, { $group: { _id: '$paymentMethodType', count: { $sum: 1 }, revenue: { $sum: '$totalOrderPrice' } } }]),
      this.orderModel.aggregate([{ $match: { paidAt: this.currentMonthRange(), ...matchStage } }, { $group: { _id: { $dayOfMonth: '$paidAt' }, orders: { $sum: 1 }, revenue: { $sum: '$totalOrderPrice' } } }, { $sort: { _id: 1 } }]),
      this.orderModel.find(matchStage).sort({ createdAt: -1 }).limit(5).populate('user', 'name email').populate('course', 'title').populate('package', 'title').populate('coursePackage', 'title'),
      this.productDetails(query),
    ]);

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const currentMonthData = monthlyStats.find((stat: any) => stat._id.month === currentMonth && stat._id.year === currentYear) || { orders: 0, revenue: 0 };
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const previousMonthData = monthlyStats.find((stat: any) => stat._id.month === previousMonth && stat._id.year === previousYear) || { orders: 0, revenue: 0 };
    const growthRate = {
      orderGrowth: `${previousMonthData.orders === 0 ? (currentMonthData.orders > 0 ? 100 : 0) : (((currentMonthData.orders - previousMonthData.orders) / previousMonthData.orders) * 100).toFixed(1)}%`,
      revenueGrowth: `${previousMonthData.revenue === 0 ? (currentMonthData.revenue > 0 ? 100 : 0) : (((currentMonthData.revenue - previousMonthData.revenue) / previousMonthData.revenue) * 100).toFixed(1)}%`,
    };
    return { status: 'success', data: { productDetails, overview: overallStats[0], monthlyStats, paymentMethods: paymentMethodStats, dailyStats, recentOrders, growthRate } };
  }

  async getOrdersByMonth(query: Record<string, any>) {
    const { month, year } = query;
    if (!month || !year) throw new BadRequestException('Please provide both month and year');
    const matchStage = this.productMatchStage(query);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const [orders, stats, productDetails] = await Promise.all([
      this.orderModel.find({ paidAt: { $gte: startDate, $lte: endDate }, ...matchStage }).sort({ paidAt: -1 }),
      this.orderModel.aggregate([{ $match: { paidAt: { $gte: startDate, $lte: endDate }, ...matchStage } }, { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$totalOrderPrice' }, avgOrderValue: { $avg: '$totalOrderPrice' }, paidOrders: { $sum: { $cond: ['$isPaid', 1, 0] } }, resaleOrders: { $sum: { $cond: ['$isResale', 1, 0] } } } }]),
      this.productDetails(query),
    ]);
    return { status: 'success', data: { productDetails, monthStats: stats[0] || null, orders } };
  }

  private productMatchStage(query: Record<string, any>) {
    if (query.courseId) return { course: new Types.ObjectId(query.courseId) };
    if (query.packageId) return { package: new Types.ObjectId(query.packageId) };
    if (query.coursePackageId) return { coursePackage: new Types.ObjectId(query.coursePackageId) };
    return {};
  }

  private currentMonthRange() {
    const currentDate = new Date();
    return {
      $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      $lte: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0),
    };
  }

  private productDetails(query: Record<string, any>) {
    if (query.courseId) return this.courseModel.findById(query.courseId).select('title');
    if (query.packageId) return this.packageModel.findById(query.packageId).select('title');
    if (query.coursePackageId) return this.coursePackageModel.findById(query.coursePackageId).select('title');
    return null;
  }

  private async listDocuments(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}) {
    const totalCount = await model.countDocuments(filter);
    const data = await new ApiQueryHelper(model.find(filter), query, '-createdAt').search(modelName).sort().limitFields().paginate();
    const currentPage = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 50;
    const numberOfPages = Math.ceil(totalCount / limit);
    return {
      results: data.length,
      paginationResult: { totalCount, currentPage, limit, numberOfPages, nextPage: currentPage < numberOfPages ? currentPage + 1 : null },
      data,
    };
  }
}
