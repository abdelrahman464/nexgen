import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateInvoiceDto, PaymentDetailsDto } from './dto/marketing-revenue.dto';
import { MarketingAnalyticsService } from './marketing-analytics.service';

@Injectable()
export class InstructorProfitsService {
  constructor(
    @InjectModel('InstructorProfits') private readonly instructorProfitsModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly analytics: MarketingAnalyticsService,
  ) {}

  async createInstructorProfitsDocument(instructor: string) {
    const existing = await this.instructorProfitsModel.findOne({ instructor });
    if (existing) return 'instructor profits already exists';
    const user = await this.userModel.findOne({ _id: instructor }).select('_id isInstructor');
    if (!user) return "this instructor don't exists";
    if (!user.isInstructor) return 'this user is not an instructor';
    await this.instructorProfitsModel.create({ instructor });
    return true;
  }

  getOne(instructorId: string) {
    return this.instructorProfitsModel.findOne({ instructor: instructorId });
  }

  async createInstructorProfitsInvoice(instructorId: string, body: CreateInvoiceDto) {
    const instructorProfits = await this.instructorProfitsModel.findOne({ instructor: instructorId });
    if (!instructorProfits) throw new NotFoundException('No instructor profits found');
    if (instructorProfits.profits === 0) throw new NotFoundException('No profits found to be calculated');
    const availableProfits = instructorProfits.profits - instructorProfits.withdrawals;
    if (body.amount > availableProfits) throw new BadRequestException('amount is greater than profits');
    const startPointDate = instructorProfits.invoices?.length ? instructorProfits.invoices.at(-1).createdAt : instructorProfits.createdAt;
    instructorProfits.invoices.push({
      totalSalesMoney: instructorProfits.totalSalesMoney,
      profits: body.amount,
      desc: `Invoice for period : ${startPointDate.toLocaleString('default', { month: 'long' })} ${startPointDate.getDate()} (${startPointDate.toLocaleString('en-US', { weekday: 'long' })}) to  ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()} (${new Date().toLocaleString('en-US', { weekday: 'long' })})`,
    });
    instructorProfits.withdrawals += body.amount;
    await instructorProfits.save();
    return true;
  }

  async setInstructorProfitsPaymentDetails(instructorId: string, body: PaymentDetailsDto) {
    const instructorProfits = await this.instructorProfitsModel.findOne({ instructor: instructorId });
    if (!instructorProfits) throw new NotFoundException('No instructorProfits found');
    instructorProfits.paymentMethod = body.paymentMethod;
    instructorProfits.receiverAcc = body.receiverAcc;
    await instructorProfits.save();
    return true;
  }

  async getInstructorAnalytics(id: string | undefined, user: any) {
    const instructorId = id || user._id;
    const instructorProfits = await this.instructorProfitsModel.findOne({ instructor: instructorId }).populate('instructor', 'name email profileImg');
    if (!instructorProfits) throw new NotFoundException('InstructorProfits document not found');
    const courses = await this.courseModel.find({ instructor: instructorId }).select('_id');
    const packages = await this.packageModel.find({ instructor: instructorId }).select('_id');
    const totalEnrollments = await this.orderModel.count({
      $or: [{ course: { $in: courses.map((course: any) => course._id) } }, { package: { $in: packages.map((pack: any) => pack._id) } }],
    });
    return {
      status: 'success',
      totalEnrollments,
      totalEnrollmentsDiff: 32,
      avgRate: 4,
      avgRateDiff: 1.3,
      instructorProfits: instructorProfits.profits || 0,
      instructorProfitsDiff: 300,
      withdrawals: instructorProfits.withdrawals || 0,
      totalSalesMoney: instructorProfits.totalSalesMoney || 0,
      commissions: instructorProfits.commissions || [],
      invoices: instructorProfits.invoices || [],
    };
  }

  async getCourseAnalytics(itemId: string, query: Record<string, any>) {
    const { type } = query;
    if (!type) throw new BadRequestException('type query parameter is required');
    if (!['course', 'package', 'coursePackage'].includes(type)) throw new BadRequestException('type query parameter is invalid');
    const item = await this.getItemData(type, itemId);
    if (!item) throw new NotFoundException('Item not found');
    const dateFilter: Record<string, any> = {};
    if (query.startDate || query.endDate) {
      dateFilter.createdAt = {};
      if (query.startDate) dateFilter.createdAt.$gte = this.parseDayMonthYear(query.startDate, false);
      if (query.endDate) dateFilter.createdAt.$lte = this.parseDayMonthYear(query.endDate, true);
    }
    const queryFilter: Record<string, any> = { isPaid: true, ...dateFilter, [type]: itemId };
    const orders = await this.orderModel.find(queryFilter).select('totalOrderPrice user createdAt paidAt isResale');
    const totalSales = orders.reduce((sum: number, order: any) => sum + (order.totalOrderPrice || 0), 0);
    const registeredUsers = orders
      .filter((order: any) => order.user)
      .map((order: any) => ({
        _id: order.user._id || '',
        name: order.user.name || '',
        email: order.user.email || '',
        profileImg: order.user.profileImg || '',
        isResale: order.isResale || false,
        paidAt: order.paidAt || '',
        createdAt: order.createdAt || '',
      }));
    return {
      status: 'success',
      item: { _id: item._id, title: item.title, price: item.price, instructor: item.instructor },
      totalSales,
      totalRegisteredUsers: registeredUsers.length,
      registeredUsers,
      filters: { startDate: query.startDate || null, endDate: query.endDate || null },
    };
  }

  async getTotalSalesAnalytics(id: string | undefined, user: any, query: Record<string, any>, locale = 'ar') {
    const instructorId = id || user._id;
    const filter: Record<string, any> = { instructor: instructorId };
    if (query.month) filter.createdAt = this.getMonthRange(query.month);
    const orders = await this.orderModel.find(filter);
    if (!orders.length) throw new NotFoundException('No orders found for this instructor');
    const result = this.analytics.calculateSalesAnalytics(orders, locale);
    const currentMonthRegistrations = orders.filter((order: any) => order.user?.createdAt?.getMonth() === new Date().getMonth()).length || 0;
    return { status: 'success', month: query.month, totalSales: result.totalSales, currentMonthRegistrations, analytics: result.analytics };
  }

  async getSalesAnalytics(id: string | undefined, user: any) {
    const instructorId = id || user._id;
    const [courses, packages, coursePackages] = await Promise.all([
      this.courseModel.find({ instructor: instructorId }),
      this.packageModel.find({ instructor: instructorId }),
      this.coursePackageModel.find({ instructor: instructorId }),
    ]);
    const orders = await this.orderModel
      .find({
        $or: [
          { course: { $in: courses.map((item: any) => item._id) } },
          { package: { $in: packages.map((item: any) => item._id) } },
          { coursePackage: { $in: coursePackages.map((item: any) => item._id) } },
        ],
        isPaid: true,
      })
      .select('course package coursePackage totalOrderPrice')
      .lean();
    const sales: Record<string, any> = {};
    orders.forEach((order: any) => {
      const item = order.course || order.package || order.coursePackage;
      if (!item) return;
      const itemId = item._id.toString();
      if (!sales[itemId]) {
        sales[itemId] = {
          itemId,
          itemType: order.course ? 'course' : order.package ? 'package' : 'coursePackage',
          itemTitle: item.title,
          totalSalesMoney: 0,
          ordersCount: 0,
        };
      }
      sales[itemId].totalSalesMoney += order.totalOrderPrice || 0;
      sales[itemId].ordersCount += 1;
    });
    const salesArray = Object.values(sales);
    const totalSalesMoney = salesArray.reduce((sum: number, item: any) => sum + item.totalSalesMoney, 0);
    const totalOrders = salesArray.reduce((sum: number, item: any) => sum + item.ordersCount, 0);
    const salesWithPercentage = salesArray
      .map((item: any) => ({ ...item, percentageOfTotalSales: totalSalesMoney > 0 ? parseFloat(((item.totalSalesMoney / totalSalesMoney) * 100).toFixed(2)) : 0 }))
      .sort((a: any, b: any) => b.percentageOfTotalSales - a.percentageOfTotalSales);
    return { status: 'success', sales: salesWithPercentage, totalSalesMoney, totalOrders };
  }

  async getInstructorProfitsInvoices(status: string) {
    const logs = await this.instructorProfitsModel.find({ 'invoices.status': status }).populate('instructor', 'name email profileImg');
    if (!logs.length) throw new NotFoundException(`No invoices with status ${status}`);
    const data = logs.map((log: any) => ({
      _id: log._id,
      role: 'instructor',
      marketer: log.instructor,
      invoices: log.invoices.filter((invoice: any) => invoice.status === status),
    }));
    return { status: 'success', length: data.length, data };
  }

  async updateInstructorProfitsInvoiceStatus(invoiceId: string, status: string) {
    const log = await this.instructorProfitsModel.findOne({ 'invoices._id': invoiceId });
    if (!log) return false;
    log.invoices.id(invoiceId).status = status;
    log.invoices.id(invoiceId).paidAt = status === 'paid' ? new Date() : null;
    await log.save();
    return true;
  }

  private getItemData(type: string, itemId: string) {
    if (type === 'course') return this.courseModel.findById(itemId).select('title price instructor');
    if (type === 'package') return this.packageModel.findById(itemId).select('title price instructor');
    return this.coursePackageModel.findById(itemId);
  }

  private parseDayMonthYear(value: string, endOfDay: boolean) {
    const [day, month, year] = value.split('/');
    return new Date(Number(year), Number(month) - 1, Number(day), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  }

  private getMonthRange(yyyyMm: string) {
    const [year, month] = yyyyMm.split('-').map(Number);
    return { $gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)), $lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
  }
}
