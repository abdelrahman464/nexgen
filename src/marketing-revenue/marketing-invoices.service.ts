import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InvoiceQueryDto, UpdateInvoiceStatusDto } from './dto/marketing-revenue.dto';
import { InstructorProfitsService } from './instructor-profits.service';

@Injectable()
export class MarketingInvoicesService {
  constructor(
    @InjectModel('MarketingLogs') private readonly marketingLogModel: Model<any>,
    private readonly instructorProfits: InstructorProfitsService,
  ) {}

  async getAllRequestedInvoices(status = 'pending', query: InvoiceQueryDto, locale = 'ar') {
    let result: any;
    if (query.invoiceType === 'wallet') result = await this.getWalletInvoices(status);
    else if (query.invoiceType === 'profit') result = await this.getProfitsInvoices(status, locale);
    else result = await this.instructorProfits.getInstructorProfitsInvoices(status);
    if (!result || result.length === 0) throw new NotFoundException('no invoices found');
    return result;
  }

  async getRequestedInvoice(id: string) {
    const requestedInvoices = await this.marketingLogModel
      .findOne({ 'invoices._id': id })
      .select('-hasSentRequest -wallet -transactions -direct_transactions -totalSalesMoney -__v -createdAt -updatedAt');
    if (!requestedInvoices) throw new NotFoundException('no invoice found');
    requestedInvoices.invoices = requestedInvoices.invoices.id(id);
    return { status: 'success', data: requestedInvoices };
  }

  async updateInvoiceStatus(id: string, query: InvoiceQueryDto, body: UpdateInvoiceStatusDto) {
    let acknowledgement = false;
    if (query.invoiceType === 'wallet') acknowledgement = await this.updateWalletInvoiceStatus(id, body.status);
    else if (query.invoiceType === 'profit') acknowledgement = await this.updateProfitInvoiceStatus(id, body.status);
    else acknowledgement = await this.instructorProfits.updateInstructorProfitsInvoiceStatus(id, body.status);
    if (!acknowledgement) throw new NotFoundException('no invoice found');
    return { status: 'success', msg: 'invoice updated' };
  }

  createProfitsInvoice(marketLog: any) {
    const { profitPercentage, totalSalesMoney, profits, sales, withdrawals } = marketLog;
    if (!profits || profits === 0 || profits === withdrawals) return marketLog;
    const availableProfits = profits - withdrawals;
    marketLog.invoices.push({
      totalSalesMoney: Number(totalSalesMoney || 0).toFixed(2),
      mySales: sales?.length || 0,
      createdBy: 'system',
      orders: sales?.map((sale: any) => sale.order) || [],
      profitPercentage,
      profits: availableProfits,
      desc: `final invoice for month ${new Date().getMonth()}`,
    });
    return marketLog;
  }

  createCommissionInvoice(marketLog: any) {
    if (!marketLog.commissions?.length) return marketLog;
    const profits = marketLog.commissions.reduce((acc: number, commission: any) => acc + (Number(commission.profit) || 0), 0);
    const invoice = { profits: Number((profits / 2).toFixed(2)), desc: `Invoice for month ${new Date().getMonth()}` };
    marketLog.walletInvoices.push(invoice);
    marketLog.commissionsInvoices.push(invoice);
    return marketLog;
  }

  private async getProfitsInvoices(status: string, locale: string) {
    let marketLogs = await this.marketingLogModel
      .find({ 'invoices.status': status }, { marketer: 1, invoices: 1, role: 1, _id: 1 })
      .populate('marketer', 'name email profileImg')
      .populate({ path: 'invoices.orders', select: 'user course coursePackage package totalOrderPrice paymentMethodType paidAt createdAt' })
      .lean();
    if (!marketLogs.length) return [];
    marketLogs = marketLogs.map((log: any) => ({ _id: log._id, role: log.role, marketer: log.marketer, invoices: log.invoices.filter((invoice: any) => invoice.status === status) }));
    marketLogs.forEach((log: any) => {
      log.invoices?.forEach((invoice: any) => {
        invoice.orderNum = invoice.orders?.length;
        invoice.orders?.forEach((order: any) => this.localizeOrderTitle(order, locale));
      });
    });
    const length = marketLogs.reduce((acc: number, log: any) => acc + log.invoices.length, 0);
    return { status: 'success', length, data: marketLogs };
  }

  private async getWalletInvoices(status: string) {
    const requestedInvoices = await this.marketingLogModel.find({ 'walletInvoices.status': status }).populate('marketer', 'name email profileImg');
    if (!requestedInvoices.length) return [];
    const data = requestedInvoices.map((log: any) => ({
      _id: log._id,
      role: log.role,
      marketer: log.marketer,
      invoices: log.walletInvoices.filter((invoice: any) => invoice.status === status),
    }));
    return { status: 'success', length: data.length, data };
  }

  private async updateProfitInvoiceStatus(id: string, status: string) {
    const marketLog = await this.marketingLogModel.findOne({ 'invoices._id': id });
    if (!marketLog) return false;
    const invoice = marketLog.invoices.id(id);
    invoice.status = status;
    invoice.paidAt = status === 'paid' ? new Date() : null;
    await marketLog.save();
    return true;
  }

  private async updateWalletInvoiceStatus(id: string, status: string) {
    const marketLog = await this.marketingLogModel.findOne({ 'walletInvoices._id': id });
    if (!marketLog) return false;
    const invoice = marketLog.walletInvoices.id(id);
    invoice.status = status;
    invoice.paidAt = status === 'paid' ? new Date() : null;
    await marketLog.save();
    return true;
  }

  private localizeOrderTitle(order: any, locale: string) {
    ['course', 'package', 'coursePackage'].forEach((key) => {
      if (order[key]?.title) order[key] = { ...order[key], title: order[key].title[locale] || order[key].title.ar || order[key].title.en };
    });
  }
}
