import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ItemAnalyticsQueryDto } from './dto/marketing-revenue.dto';

@Injectable()
export class MarketingAnalyticsService {
  constructor(
    @InjectModel('MarketingLogs') private readonly marketingLogModel: Model<any>,
    @InjectModel('InvitationLinkAnalytics') private readonly invitationAnalyticsModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
  ) {}

  calculateSalesAnalytics(orders: any[], lang = 'ar') {
    const analytics: any[] = [];
    const analyticsObject: Record<string, { type: string; sales: number }> = {};
    let totalSales = 0;
    for (const order of orders) {
      const soldItem = this.getItemDetails(order, lang);
      if (!soldItem) continue;
      if (soldItem.title in analyticsObject) analyticsObject[soldItem.title].sales += order.totalOrderPrice || 0;
      else analyticsObject[soldItem.title] = { type: soldItem.type, sales: order.totalOrderPrice || 0 };
      totalSales += order.totalOrderPrice || 0;
    }
    Object.keys(analyticsObject).forEach((key) => {
      const percentage = totalSales ? ((analyticsObject[key].sales / totalSales) * 100).toFixed(2) : '0.00';
      analytics.push({ item: key, sales: analyticsObject[key].sales, type: analyticsObject[key].type, percentage });
    });
    return { totalSales, analytics };
  }

  async getTotalSalesAnalytics(marketerId: string | undefined, user: any, query: Record<string, any>, locale = 'ar') {
    if (user.role === 'user' && !user.isMarketer) throw new ForbiddenException('you are not allowed to access this route');
    const targetMarketerId = marketerId || user._id;
    const users = await this.userModel.find({ invitor: targetMarketerId }).select('_id createdAt');
    if (!users.length) throw new NotFoundException('No users found for this marketer');
    const filter: Record<string, any> = { user: { $in: users.map((item: any) => item._id) } };
    if (query.month) filter.createdAt = this.getMonthRange(query.month);
    const orders = await this.orderModel.find(filter);
    if (!orders.length) throw new NotFoundException('No orders found for this marketer');
    const result = this.calculateSalesAnalytics(orders, locale);
    const currentMonthRegistrations = users.filter((item: any) => item.createdAt?.getMonth() === new Date().getMonth()).length || 0;
    return {
      status: 'success',
      month: query.month,
      totalSales: result.totalSales,
      team: users.length,
      currentMonthRegistrations,
      analytics: result.analytics,
    };
  }

  async getItemAnalytics(itemId: string | undefined, query: ItemAnalyticsQueryDto, user: any) {
    if (user.role === 'user' && !user.isMarketer) throw new ForbiddenException('you are not allowed to access this route');
    if (!query.startDate || !query.endDate) throw new BadRequestException('startDate and endDate are required');
    const startDate = this.toDate(query.startDate);
    const endDate = this.toDate(query.endDate);
    const marketerId = query.marketerId || user._id;
    const users = await this.userModel.find({ invitor: marketerId }).select('_id');
    if (!users.length) throw new NotFoundException('No users found for this marketer');
    const filter = {
      user: { $in: users.map((item: any) => item._id) },
      $or: [{ course: itemId }, { package: itemId }, { coursePackage: itemId }],
      paidAt: { $gte: startDate, $lte: endDate },
    };
    const givenPeriodOrders = await this.orderModel.find(filter);
    if (!givenPeriodOrders.length) {
      throw new NotFoundException('No orders found for this item in this period');
    }
    const givenPeriodSales = givenPeriodOrders.reduce((acc: number, order: any) => acc + order.totalOrderPrice, 0);
    const oppositePeriodOrders = await this.getOppositePeriodOrders(itemId, startDate, endDate);
    const oppositePeriodSales = oppositePeriodOrders.reduce((acc: number, order: any) => acc + order.totalOrderPrice, 0);
    const givenPeriodResales = this.getResalesInfo(givenPeriodOrders);
    const oppositePeriodResales = this.getResalesInfo(oppositePeriodOrders);
    return {
      status: 'success',
      startDate: query.startDate,
      endDate: query.endDate,
      givenPeriodOrders,
      givenPeriodSales: givenPeriodSales.toFixed(2),
      givenPeriodStudents: givenPeriodOrders.length,
      oppositePeriodSales: oppositePeriodSales.toFixed(2),
      oppositePeriodStudents: oppositePeriodOrders.length,
      givenPeriodResales: givenPeriodResales.ResalesMoney.toFixed(2),
      givenPeriodResalesStudents: givenPeriodResales.ResalesStudents,
      oppositePeriodResales: oppositePeriodResales.ResalesMoney.toFixed(2),
      oppositePeriodResalesStudents: oppositePeriodResales.ResalesStudents,
    };
  }

  async incrementSignUpClicks(invitationKey: string) {
    const { marketerId } = await this.getMarketerFromInvitationKey(invitationKey);
    if (!marketerId) return { status: 'failed', msg: 'this invitationkey belongs to no marketer' };
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const analytics = await this.invitationAnalyticsModel.findOne({ marketer: marketerId, month, year });
    if (!analytics) {
      await this.invitationAnalyticsModel.create({ marketer: marketerId, year, month, clicksDetails: [{ invitationKey, clicks: 1 }] });
    } else {
      const click = analytics.clicksDetails.find((item: any) => item.invitationKey === invitationKey);
      if (click) click.clicks += 1;
      else analytics.clicksDetails.push({ invitationKey, clicks: 1 });
      await analytics.save();
    }
    return { status: 'success', msg: 'clicks incremented successfully' };
  }

  async getInvitationsAnalytics(marketerId: string, query: Record<string, any>) {
    const month = Number(query.month || new Date().getMonth() + 1);
    const year = Number(query.year || new Date().getFullYear());
    const clicksDetails = await this.invitationAnalyticsModel.findOne({ marketer: marketerId, month, year }).select('-__v').lean();
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);
    const registeredUsers = await this.userModel
      .find({ invitor: marketerId, createdAt: { $gte: startOfMonth, $lt: startOfNextMonth } })
      .select('_id invitationKey name email profileImg createdAt')
      .lean();
    const registeredUsersCounter = registeredUsers.reduce((acc: Record<string, any[]>, item: any) => {
      const key = item.invitationKey;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return { status: 'success', registeredUsersCounter, clicksDetails };
  }

  async getMarketerFromInvitationKey(invitationKey: string) {
    const marketer = await this.marketingLogModel.findOne({ invitationKeys: { $in: [invitationKey] } }).select('_id marketer role fallBackCoach');
    if (!marketer) return {};
    return { marketerId: marketer.marketer, marketLog: marketer };
  }

  private getItemDetails(order: any, lang: string) {
    if (order.course) return { title: order.course.title?.[lang] || order.course.title?.ar || order.course.title?.en, type: 'course' };
    if (order.package) return { title: order.package.title?.[lang] || order.package.title?.ar || order.package.title?.en, type: 'package' };
    if (order.coursePackage) return { title: order.coursePackage.title?.[lang] || order.coursePackage.title?.ar || order.coursePackage.title?.en, type: 'coursePackage' };
    return null;
  }

  private getMonthRange(yyyyMm: string) {
    if (!/^\d{4}-\d{2}$/.test(yyyyMm)) throw new BadRequestException('Invalid date format. Please use "yyyy-mm"');
    const [year, month] = yyyyMm.split('-').map(Number);
    return { $gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)), $lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
  }

  private toDate(dateString: string) {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private async getOppositePeriodOrders(itemId: string | undefined, startDate: Date, endDate: Date) {
    const duration = endDate.getTime() - startDate.getTime();
    const pastEnd = new Date(startDate);
    pastEnd.setDate(pastEnd.getDate() - 1);
    const pastStart = new Date(pastEnd.getTime() - duration);
    return this.orderModel.find({ $or: [{ course: itemId }, { package: itemId }, { coursePackage: itemId }], paidAt: { $gte: pastStart, $lte: pastEnd } });
  }

  private getResalesInfo(orders: any[]) {
    return orders.reduce(
      (acc, order) => ({
        ResalesMoney: acc.ResalesMoney + (order.isResale ? order.totalOrderPrice : 0),
        ResalesStudents: acc.ResalesStudents + (order.isResale ? 1 : 0),
      }),
      { ResalesMoney: 0, ResalesStudents: 0 },
    );
  }
}
