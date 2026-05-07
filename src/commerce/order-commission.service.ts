import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class OrderCommissionService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('MarketingLogs') private readonly marketingLogModel: Model<any>,
    @InjectModel('InstructorProfits') private readonly instructorProfitsModel: Model<any>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('Chat') private readonly chatModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  async handleOrderCommissions(item: any, saleDetails: Record<string, any>) {
    let sellerPercentage = 0;
    let totalMarketingProfits = 0;
    let headMarketerPercentage = 0;

    if (saleDetails.invitor) {
      const marketer = await this.marketingLogModel.findOne({ marketer: saleDetails.invitor });
      const profitableItem = this.getProfitableItem(marketer, item._id, saleDetails.itemType);
      if (profitableItem) {
        sellerPercentage = profitableItem.percentage;
        saleDetails.marketerPercentage = sellerPercentage;
        const head = await this.marketingLogModel.findOne({ marketer: marketer.invitor });
        const headProfitableItem = this.getProfitableItem(head, item._id, saleDetails.itemType);
        if (headProfitableItem) {
          headMarketerPercentage = headProfitableItem.percentage;
          saleDetails.headMarketerPercentage = headMarketerPercentage;
        }
      }
    }

    if (item.instructorPercentage) {
      saleDetails.instructorPercentage = item.instructorPercentage;
      saleDetails.instructorId = item.instructor;
      const instructorProfit = (Number(saleDetails.amount || 0) * saleDetails.instructorPercentage) / 100;
      saleDetails.totalProfits = instructorProfit;
      saleDetails.netInstructorProfit = instructorProfit;
      if (headMarketerPercentage > 0 || sellerPercentage > 0) {
        totalMarketingProfits = (instructorProfit * (headMarketerPercentage || sellerPercentage)) / 100;
        saleDetails.netInstructorProfit = instructorProfit - totalMarketingProfits;
        saleDetails.totalMarketingProfits = totalMarketingProfits;
      }
      saleDetails.instructorProfits = saleDetails.netInstructorProfit;
      await this.giveInstructorHisCommission(saleDetails);
    }

    if (sellerPercentage > 0) {
      saleDetails.sellerProfits = (Number(saleDetails.totalProfits || 0) * sellerPercentage) / 100;
      const netHeadMarketerPercentage = headMarketerPercentage - sellerPercentage;
      saleDetails.headMarketerPercentage = netHeadMarketerPercentage;
      saleDetails.headMarketerProfits = (Number(saleDetails.totalProfits || 0) * netHeadMarketerPercentage) / 100;
      await this.calculateProfits(saleDetails);
    }
  }

  private getProfitableItem(marketer: any, itemId: any, itemType: string) {
    if (!marketer) return null;
    return marketer.profitableItems?.find((item: any) => item.itemId.toString() === itemId.toString() && item.itemType === itemType);
  }

  private async giveInstructorHisCommission(data: Record<string, any>) {
    try {
      await this.instructorProfitsModel.findOneAndUpdate(
        { instructor: data.instructorId },
        {
          $inc: {
            profits: data.netInstructorProfit || 0,
            totalSalesMoney: data.amount,
          },
          $push: {
            commissions: {
              order: data.order,
              type: data.itemType,
              amount: data.amount,
              percentage: data.instructorPercentage,
              totalProfits: data.totalProfits,
              profit: data.netInstructorProfit || 0,
              marketer: data.invitor || null,
              marketerPercentage: data.headMarketerPercentage || data.marketerPercentage || 0,
              marketerProfits: data.totalMarketingProfits || 0,
              createdAt: new Date(),
            },
          },
        },
      );
      await this.orderModel.findOneAndUpdate(
        { _id: data.order },
        {
          instructorPercentage: data.instructorPercentage,
          instructorProfits: data.totalProfits,
        },
      );
    } catch (error) {
      console.log(error instanceof Error ? error.message : error);
    }
  }

  private async calculateProfits(details: Record<string, any>) {
    try {
      const user = await this.userModel.findOne({ email: details.email }).select('invitor');
      if (!user?.invitor) throw new Error('user has no valid invitor');
      await this.addMemberToMarketingChat(user._id, user.invitor);

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

      if (details.headMarketerPercentage > 0 && details.headMarketerProfits > 0) {
        await this.updateHeadCommission({
          marketerId: marketLog.marketer,
          invitorId: marketLog.invitor,
          headMarketerProfits: details.headMarketerProfits,
        });
      }
      return true;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private async updateHeadCommission(data: Record<string, any>) {
    const headMarketLog = await this.marketingLogModel.findOne({ marketer: data.invitorId });
    if (!headMarketLog) return;

    const profit = data.headMarketerProfits;
    const totalProfits = headMarketLog.profits + profit;
    let hasBeenUpdated = false;
    headMarketLog.commissions?.forEach((commission: any) => {
      if (commission.member.toString() === data.marketerId.toString()) {
        commission.profit += profit;
        commission.lastUpdate = new Date();
        hasBeenUpdated = true;
      }
    });
    headMarketLog.profits += parseFloat(profit.toFixed(2));
    if (hasBeenUpdated) {
      headMarketLog.commissionsProfits += profit;
      headMarketLog.totalProfits = totalProfits;
      await headMarketLog.save();
      return;
    }

    await this.marketingLogModel.findOneAndUpdate(
      { marketer: data.invitorId },
      {
        $push: {
          commissions: {
            member: data.marketerId,
            profit: profit.toFixed(2),
          },
        },
        $inc: {
          profits: parseFloat(profit.toFixed(2)),
          commissionsProfits: parseFloat(profit.toFixed(2)),
          totalProfits,
        },
      },
    );
  }

  private async addMemberToMarketingChat(userId: string, marketerId: string) {
    const chat = await this.chatModel.findOneAndUpdate(
      { creator: marketerId, type: 'marketingTeam' },
      { $addToSet: { participants: { user: userId } } },
      { new: true },
    );
    if (!chat) return true;
    await this.notificationModel.create({
      user: userId,
      message: {
        en: 'you have been to a group chat with your marketer',
        ar: 'تمت اضافتك الى محادثة جماعية مع مسوقك',
      },
      chat: chat._id,
      type: 'chat',
    });
    return true;
  }
}
