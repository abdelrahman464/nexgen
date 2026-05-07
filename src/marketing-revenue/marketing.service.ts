import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateInvoiceDto, ModifyInvitationKeysDto, ModifyProfitableItemsDto, PaymentDetailsDto, ProfitCalculationDto, StartMarketingDto } from './dto/marketing-revenue.dto';
import { InstructorProfitsService } from './instructor-profits.service';

@Injectable()
export class MarketingService {
  constructor(
    @InjectModel('MarketingLogs') private readonly marketingLogModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    private readonly instructorProfits: InstructorProfitsService,
  ) {}

  async startMarketing(userId: string, body: StartMarketingDto, user: any) {
    let role = body.role;
    if (role === 'instructor') {
      const result = await this.instructorProfits.createInstructorProfitsDocument(userId);
      if (typeof result === 'string') return { status: 'failed', msg: result };
      role = 'marketer';
    }
    const exists = await this.marketingLogModel.exists({ marketer: userId });
    if (exists) return { status: 'failed', msg: 'this user already a marketer' };
    const currentUser = await this.userModel.findOne({ _id: user._id }).select('_id name invitor');
    await this.marketingLogModel.create({ marketer: userId, invitor: currentUser.invitor, role, fallBackCoach: body.fallBackCoach });
    await this.userModel.findOneAndUpdate({ _id: userId }, role === 'affiliate' ? { isAffiliateMarketer: true } : { isMarketer: true });
    try {
      const { createMarketerGroupChat } = require('../../services/ChatServices');
      await createMarketerGroupChat(currentUser);
    } catch (error) {
      console.error('Failed to create marketer group chat:', error);
    }
    return { msg: 'success', message: 'this user has started marketing successfully' };
  }

  async getMarketLog(id: string | undefined, user: any, locale = 'ar') {
    const marketerId = id || user._id;
    if (id && user.role !== 'admin' && user._id.toString() !== id) throw new ForbiddenException('Not Authorized');
    const marketLog = await this.marketingLogModel
      .findOne({ marketer: marketerId })
      .populate('marketer', 'name email profileImg')
      .populate('invitor', 'name email profileImg')
      .populate('sales.purchaser', 'name email profileImg')
      .populate('commissions.member', 'name email profileImg')
      .lean();
    if (!marketLog) throw new NotFoundException('marketing-errors.marketLog-Not-Found');
    if (marketLog.commissions?.length) {
      marketLog.walletBalance = marketLog.commissions.reduce((acc: number, item: any) => acc + item.profit / 2, 0);
      marketLog.commissionsBalance = marketLog.walletBalance;
    }
    marketLog.availableToWithdraw = marketLog.profits - marketLog.withdrawals;
    if (marketLog.invoices?.length) {
      const lastMonth = this.getMonthBoundaries().lastMonth;
      const lastMonthAnalytics = this.getMonthMoney(marketLog.invoices, lastMonth.firstDay, lastMonth.lastDay);
      if (lastMonthAnalytics.monthSalesMoney) marketLog.salesMoneyDifference = marketLog.totalSalesMoney - lastMonthAnalytics.monthSalesMoney;
      if (lastMonthAnalytics.monthProfits) marketLog.profitsDifference = marketLog.profits - lastMonthAnalytics.monthProfits;
    }
    const instructorProfits = marketLog.role === 'instructor' ? await this.instructorProfits.getOne(marketLog.marketer) : null;
    marketLog.sales?.forEach((sale: any) => {
      if (sale.item?.[locale]) sale.item = sale.item[locale];
    });
    marketLog.profitableItemsDetails = await this.getProfitableItemsDetails(marketLog.profitableItems || []);
    return { status: 'success', marketLog, instructorProfits };
  }

  async getMarketerChildren(id: string, locale = 'ar') {
    const teamMembers = await this.userModel.find({ invitor: id }).select('name email phone profileImg createdAt timeSpent').lean();
    if (!teamMembers.length) throw new NotFoundException('marketing-errors.No-Team-Members');
    const result = await this.filterTeamMembers(teamMembers, locale);
    return { status: 'success', totalRegistrations: teamMembers.length, ...result };
  }

  async updateProfitCalculation(id: string, body: ProfitCalculationDto) {
    const marketLog = await this.marketingLogModel.findOne({ _id: id });
    if (!marketLog) throw new NotFoundException('MarketLog not found');
    let { profitPercentage, commissionsProfitsPercentage } = body;
    if (body.profitsCalculationMethod === 'auto') profitPercentage = this.detectPercentage(marketLog.role, marketLog.totalSalesMoney);
    await this.marketingLogModel.findOneAndUpdate(
      { _id: id },
      {
        profitsCalculationMethod: body.profitsCalculationMethod,
        profitPercentage,
        commissionsProfitsCalculationMethod: body.commissionsProfitsCalculationMethod,
        commissionsProfitsPercentage,
      },
    );
    return { status: 'success', msg: 'MarketLog profits calculation method updated successfully' };
  }

  async modifyInvitationKeys(id: string, body: ModifyInvitationKeysDto) {
    const marketLog = await this.marketingLogModel.findOne({ marketer: id }).select('_id invitationKeys');
    if (!marketLog) throw new NotFoundException('No marketerLog found');
    if (body.option === 'add') {
      const exists = await this.marketingLogModel.findOne({ invitationKeys: body.invitationKey });
      if (exists) throw new BadRequestException('invitationKey already exist');
      marketLog.invitationKeys.push(body.invitationKey);
    } else {
      marketLog.invitationKeys = marketLog.invitationKeys.filter((key: string) => key !== body.invitationKey);
    }
    await marketLog.save();
    return { status: 'success', msg: 'done' };
  }

  async setPaymentDetails(id: string, body: PaymentDetailsDto, type?: string) {
    if (type === 'instructor') {
      await this.instructorProfits.setInstructorProfitsPaymentDetails(id, body);
    } else {
      const marketLog = await this.marketingLogModel.findOne({ marketer: id });
      if (!marketLog) throw new NotFoundException('No marketerLog found');
      marketLog.paymentDetails = { paymentMethod: body.paymentMethod, receiverAcc: body.receiverAcc };
      await marketLog.save();
    }
    return { status: 'success', msg: 'payment details added successfully' };
  }

  async calculateProfitsManual(details: Record<string, any>) {
    const result = await this.calculateProfits(details);
    if (result !== true) return { status: 'failed', msg: result };
    return { status: 'success', msg: 'profits calculated successfully' };
  }

  async calculateProfits(details: Record<string, any>) {
    try {
      const user = await this.userModel.findOne({ email: details.email }).select('invitor');
      if (!user?.invitor) throw new Error('user has no valid invitor');
      const marketLog = await this.marketingLogModel.findOne({ marketer: user.invitor }).select('-sales -invoices -createdAt -updatedAt');
      if (!marketLog) throw new Error('seller has no marketLog');
      await this.marketingLogModel.findOneAndUpdate(
        { marketer: marketLog.marketer },
        {
          $push: {
            sales: {
              purchaser: user._id,
              order: details.order,
              instructorProfits: details.totalProfits,
              percentage: details.sellerPercentage || 0,
              amount: Number(details.amount || 0).toFixed(2),
              profits: details.sellerProfits || 0,
              itemType: details.itemType,
              item: details.item || null,
            },
          },
          $inc: {
            totalSalesMoney: parseFloat(Number(details.amount || 0).toFixed(2)),
            profits: details.sellerProfits || 0,
          },
        },
      );
      return true;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async createInvoice(id: string, body: CreateInvoiceDto, type?: string) {
    if (!type || type === 'marketer') {
      const marketLog = await this.marketingLogModel.findOne({ marketer: id });
      if (!marketLog) throw new NotFoundException('marketing-error.marketLog-Not-Found');
      const result = await this.createProfitsInvoiceForAmount(marketLog, body.amount);
      if (typeof result === 'string') throw new NotFoundException(result);
    } else if (type === 'instructor') {
      await this.instructorProfits.createInstructorProfitsInvoice(id, body);
    }
    return { status: 'success', msg: 'invoice created successfully' };
  }

  async modifyProfitableItems(id: string, body: ModifyProfitableItemsDto) {
    const marketLog = await this.marketingLogModel.findOne({ marketer: id });
    if (!marketLog) throw new NotFoundException('MarketLog not found');
    marketLog.profitableItems = body.profitableItems;
    await marketLog.save();
    return { status: 'success', msg: 'MarketLog profitable items updated successfully' };
  }

  async getProfitableItemsByType(user: any, type?: string, locale = 'ar') {
    const validTypes = ['course', 'package', 'coursePackage'];
    if (!type || !validTypes.includes(type)) throw new BadRequestException(`Type must be one of: ${validTypes.join(', ')}`);
    const marketLog = await this.marketingLogModel.findOne({ marketer: user._id });
    if (!marketLog) throw new NotFoundException('Marketing log not found for this user');
    const filteredItems = marketLog.profitableItems.filter((item: any) => item.itemType === type);
    if (!filteredItems.length) return { status: 'failed', msg: `No profitable items for ${type}`, data: [] };
    const items = await this.modelForType(type).find({ _id: { $in: filteredItems.map((item: any) => item.itemId) } });
    const data = items.map((item: any) => {
      const plain = item.toObject ? item.toObject() : item;
      const profitableItem = filteredItems.find((entry: any) => entry.itemId.toString() === plain._id.toString());
      return { ...plain, title: plain.title?.[locale] || plain.title, percentage: profitableItem?.percentage || 0 };
    });
    return { status: 'success', results: data.length, data };
  }

  async moveOrdersFromOneToOne(exporter: string, importer: string, userId: string) {
    const exporterLog = await this.marketingLogModel.findOne({ marketer: exporter, sales: { $exists: true, $not: { $size: 0 } } });
    if (!exporterLog) return 'No orders found';
    const importerLog = await this.marketingLogModel.findOne({ marketer: importer });
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

  @Cron('0 0 0 1 * *')
  async resetMarketLogs() {
    const marketLogs = await this.marketingLogModel.find({
      $or: [
        { totalSalesMoney: { $gt: 0 } },
        { sales: { $exists: true, $not: { $size: 0 } } },
        { commissions: { $exists: true, $not: { $size: 0 } } },
      ],
    });
    const heads = marketLogs.filter((log: any) => log.role === 'head');
    const others = marketLogs.filter((log: any) => log.role !== 'head');
    await Promise.all(heads.map((log: any) => this.resetOneMarketLog(log, false)));
    await Promise.all(others.map((log: any) => this.resetOneMarketLog(log, true)));
    return true;
  }

  createProfitsInvoice(log: any) {
    if (!log.profits || log.profits === 0 || log.profits === log.withdrawals) return log;
    const availableProfits = log.profits - log.withdrawals;
    log.invoices.push({
      totalSalesMoney: Number(log.totalSalesMoney || 0).toFixed(2),
      mySales: log.sales?.length || 0,
      createdBy: 'system',
      orders: log.sales?.map((sale: any) => sale.order) || [],
      profitPercentage: log.profitPercentage,
      profits: availableProfits,
      desc: `final invoice for month ${new Date().getMonth()}`,
    });
    return log;
  }

  createCommissionInvoice(log: any) {
    if (!log.commissions?.length) return log;
    const profits = log.commissions.reduce((acc: number, commission: any) => acc + (Number(commission.profit) || 0), 0);
    const invoice = { profits: Number((profits / 2).toFixed(2)), desc: `Invoice for month ${new Date().getMonth()}` };
    log.walletInvoices.push(invoice);
    log.commissionsInvoices.push(invoice);
    return log;
  }

  detectPercentage(role: string, totalSalesMoney: number) {
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

  getMonthBoundaries() {
    const now = new Date();
    const currentMonth = { firstDay: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), lastDay: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString() };
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = { firstDay: new Date(last.getFullYear(), last.getMonth(), 1).toISOString(), lastDay: new Date(last.getFullYear(), last.getMonth() + 1, 0, 23, 59, 59, 999).toISOString() };
    return { currentMonth, lastMonth };
  }

  getMonthMoney(invoices: any[], startDate: string, endDate: string) {
    return invoices.reduce(
      (acc, invoice) => {
        if (new Date(startDate) <= invoice.createdAt && invoice.createdAt <= new Date(endDate)) {
          acc.monthProfits += invoice.profits || 0;
          acc.monthSalesMoney += invoice.totalSalesMoney || 0;
        }
        return acc;
      },
      { monthProfits: 0, monthSalesMoney: 0 },
    );
  }

  private async resetOneMarketLog(log: any, updateOrders: boolean) {
    this.createProfitsInvoice(log);
    this.createCommissionInvoice(log);
    if (updateOrders) {
      const ordersIds = log.sales?.map((sale: any) => sale.order) || [];
      if (ordersIds.length) await this.orderModel.updateMany({ _id: { $in: ordersIds } }, { $set: { marketerPercentage: log.profitPercentage } });
    }
    log.totalSalesMoney = 0;
    log.profits = 0;
    log.sales = [];
    log.commissions = [];
    log.withdrawals = 0;
    if (!log.profitsCalculationMethod || log.profitsCalculationMethod !== 'manual') {
      log.profitPercentage = log.role === 'head' ? 20 : 10;
    }
    await log.save();
  }

  private async createProfitsInvoiceForAmount(marketLog: any, amount: number) {
    if (!marketLog.profits || marketLog.profits === 0 || marketLog.profits === marketLog.withdrawals) return 'marketing-errors.No-Profits-Found';
    const availableProfits = marketLog.profits - marketLog.withdrawals;
    if (availableProfits < amount) return 'marketing-errors.balance-Not-Enough';
    marketLog.invoices.push({ totalSalesMoney: marketLog.totalSalesMoney.toFixed(2), mySales: marketLog.sales.length, profitPercentage: marketLog.profitPercentage, profits: amount });
    marketLog.withdrawals += amount;
    await marketLog.save();
    return true;
  }

  private async filterTeamMembers(teamMembers: any[], locale: string) {
    let resaleCounter = 0;
    const orders = await this.orderModel.find({ user: { $in: teamMembers.map((user) => user._id) } });
    if (!orders.length) return { totalSubscribers: 0, teamMembers1: [], teamMembers2: teamMembers, resaleCounter };
    orders.forEach((order: any) => {
      if (order.isResale) resaleCounter += 1;
      const member = teamMembers.find((item) => item._id.toString() === order.user._id.toString());
      if (member) {
        if (!member.orders) member.orders = [];
        member.orders.push(order);
      }
    });
    return {
      totalSubscribers: teamMembers.filter((member) => member.orders).length,
      teamMembers1: teamMembers.filter((member) => member.orders),
      teamMembers2: teamMembers.filter((member) => !member.orders),
      resaleCounter,
    };
  }

  private async getProfitableItemsDetails(items: any[]) {
    const ids = { course: [], package: [], coursePackage: [] } as Record<string, any[]>;
    items.forEach((item) => ids[item.itemType]?.push(item.itemId));
    const result: Record<string, any> = {};
    if (ids.course.length) result.courses = await this.courseModel.find({ _id: { $in: ids.course } }).select('title');
    if (ids.package.length) result.packages = await this.packageModel.find({ _id: { $in: ids.package } }).select('title');
    if (ids.coursePackage.length) result.coursePackages = await this.coursePackageModel.find({ _id: { $in: ids.coursePackage } }).select('title');
    return result;
  }

  private modelForType(type: string) {
    if (type === 'course') return this.courseModel;
    if (type === 'package') return this.packageModel;
    return this.coursePackageModel;
  }
}
