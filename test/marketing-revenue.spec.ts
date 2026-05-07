import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { ItemAnalyticsQueryDto } from '../src/marketing-revenue/dto/marketing-revenue.dto';
import { InstructorProfitsService } from '../src/marketing-revenue/instructor-profits.service';
import { MarketingAnalyticsService } from '../src/marketing-revenue/marketing-analytics.service';
import { MarketingInvoicesService } from '../src/marketing-revenue/marketing-invoices.service';
import { MarketingService } from '../src/marketing-revenue/marketing.service';
import { RatingLeaderboardService } from '../src/marketing-revenue/rating-leaderboard.service';
import { UsersService } from '../src/users/users.service';

describe('Marketing revenue migration smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BASE_URL = 'https://api.example.test';
  });

  it('increments invitation clicks by creating current-month analytics', async () => {
    const marketingLogModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ marketer: 'marketer-id' }) }),
    };
    const invitationAnalyticsModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new MarketingAnalyticsService(marketingLogModel as any, invitationAnalyticsModel as any, {} as any, {} as any);

    await expect(service.incrementSignUpClicks('my-code')).resolves.toEqual({
      status: 'success',
      msg: 'clicks incremented successfully',
    });
    expect(invitationAnalyticsModel.create).toHaveBeenCalledWith(expect.objectContaining({ marketer: 'marketer-id' }));
  });

  it('calculates marketer total sales analytics with item percentages', async () => {
    const users = [{ _id: 'u1', createdAt: new Date() }];
    const userModel = { find: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(users) }) };
    const orderModel = {
      find: jest.fn().mockResolvedValue([
        { course: { title: { en: 'Course A' } }, totalOrderPrice: 75 },
        { package: { title: { en: 'Package A' } }, totalOrderPrice: 25 },
      ]),
    };
    const service = new MarketingAnalyticsService({} as any, {} as any, orderModel as any, userModel as any);

    await expect(service.getTotalSalesAnalytics('marketer', { role: 'admin' }, {}, 'en')).resolves.toMatchObject({
      status: 'success',
      totalSales: 100,
      team: 1,
      analytics: expect.arrayContaining([expect.objectContaining({ item: 'Course A', percentage: '75.00' })]),
    });
  });

  it('validates item analytics date format', async () => {
    const dto = Object.assign(new ItemAnalyticsQueryDto(), { startDate: '2026-01-01', endDate: '01/01/2026' });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('startDate');
  });

  it('starts marketing and preserves marketer response shape', async () => {
    const marketingLogModel = { exists: jest.fn().mockResolvedValue(false), create: jest.fn().mockResolvedValue({}) };
    const userModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'admin', invitor: 'head' }) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const chatModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new MarketingService(marketingLogModel as any, {} as any, userModel as any, {} as any, {} as any, {} as any, chatModel as any, {} as any);

    await expect(service.startMarketing('user-id', { role: 'marketer' }, { _id: 'admin' })).resolves.toMatchObject({
      msg: 'success',
    });
    expect(marketingLogModel.create).toHaveBeenCalledWith(expect.objectContaining({ marketer: 'user-id', role: 'marketer' }));
    expect(chatModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'marketingTeam',
        participants: [{ user: 'admin', isAdmin: true }],
        creator: 'admin',
      }),
    );
  });

  it('keeps start marketing successful when group chat creation fails', async () => {
    const marketingLogModel = { exists: jest.fn().mockResolvedValue(false), create: jest.fn().mockResolvedValue({}) };
    const userModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'admin', name: 'Admin', invitor: 'head' }) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const chatModel = { create: jest.fn().mockRejectedValue(new Error('chat failed')) };
    const service = new MarketingService(marketingLogModel as any, {} as any, userModel as any, {} as any, {} as any, {} as any, chatModel as any, {} as any);

    await expect(service.startMarketing('user-id', { role: 'marketer' }, { _id: 'admin' })).resolves.toMatchObject({
      msg: 'success',
    });
  });

  it('rejects duplicate invitation keys before adding them', async () => {
    const marketLog = { invitationKeys: [], save: jest.fn() };
    const marketingLogModel = {
      findOne: jest.fn().mockReturnValueOnce({ select: jest.fn().mockResolvedValue(marketLog) }).mockResolvedValueOnce({ _id: 'existing' }),
    };
    const service = new MarketingService(marketingLogModel as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.modifyInvitationKeys('marketer', { option: 'add', invitationKey: 'code' })).rejects.toThrow(
      'invitationKey already exist',
    );
  });

  it('routes instructor payment details to instructor profits storage', async () => {
    const instructorProfits = { setInstructorProfitsPaymentDetails: jest.fn().mockResolvedValue(true) };
    const service = new MarketingService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, instructorProfits as any);

    await service.setPaymentDetails('instructor', { paymentMethod: 'bank', receiverAcc: '123' }, 'instructor');

    expect(instructorProfits.setInstructorProfitsPaymentDetails).toHaveBeenCalledWith('instructor', {
      paymentMethod: 'bank',
      receiverAcc: '123',
    });
  });

  it('manual profit calculation appends marketer sales', async () => {
    const userModel = { findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'buyer', invitor: 'marketer' }) }) };
    const marketLogModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ marketer: 'marketer' }) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const service = new MarketingService(marketLogModel as any, {} as any, userModel as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.calculateProfitsManual({ email: 'buyer@example.com', amount: 100, sellerProfits: 15 })).resolves.toEqual({
      status: 'success',
      msg: 'profits calculated successfully',
    });
    expect(marketLogModel.findOneAndUpdate).toHaveBeenCalledWith(
      { marketer: 'marketer' },
      expect.objectContaining({ $push: expect.any(Object), $inc: expect.objectContaining({ totalSalesMoney: 100 }) }),
    );
  });

  it('blocks invoice creation when available profits are not enough', async () => {
    const marketingLogModel = { findOne: jest.fn().mockResolvedValue({ profits: 20, withdrawals: 10, totalSalesMoney: 100, sales: [], profitPercentage: 10 }) };
    const service = new MarketingService(marketingLogModel as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.createInvoice('marketer', { amount: 50 }, 'marketer')).rejects.toThrow('marketing-errors.balance-Not-Enough');
  });

  it('updates wallet invoice status on walletInvoices, not invoices', async () => {
    const walletInvoice = { _id: 'invoice-id', status: 'pending', paidAt: null };
    const marketLog = {
      walletInvoices: { id: jest.fn().mockReturnValue(walletInvoice) },
      save: jest.fn().mockResolvedValue({}),
    };
    const marketingLogModel = { findOne: jest.fn().mockResolvedValue(marketLog) };
    const service = new MarketingInvoicesService(marketingLogModel as any, {} as any);

    await expect(service.updateInvoiceStatus('invoice-id', { invoiceType: 'wallet' }, { status: 'paid' })).resolves.toEqual({
      status: 'success',
      msg: 'invoice updated',
    });
    expect(walletInvoice.status).toBe('paid');
    expect(walletInvoice.paidAt).toBeInstanceOf(Date);
  });

  it('monthly reset creates invoices, resets fields, and updates order percentages', async () => {
    const log = {
      role: 'marketer',
      totalSalesMoney: 500,
      profits: 100,
      withdrawals: 20,
      sales: [{ order: 'order-id' }],
      commissions: [{ profit: 40 }],
      invoices: [],
      walletInvoices: [],
      commissionsInvoices: [],
      profitPercentage: 15,
      save: jest.fn().mockResolvedValue({}),
    };
    const marketingLogModel = { find: jest.fn().mockResolvedValue([log]) };
    const orderModel = { updateMany: jest.fn().mockResolvedValue({}) };
    const service = new MarketingService(marketingLogModel as any, orderModel as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await service.resetMarketLogs();

    expect(log.invoices).toHaveLength(1);
    expect(log.walletInvoices).toHaveLength(1);
    expect(orderModel.updateMany).toHaveBeenCalledWith({ _id: { $in: ['order-id'] } }, { $set: { marketerPercentage: 15 } });
    expect(log.totalSalesMoney).toBe(0);
    expect(log.save).toHaveBeenCalled();
  });

  it('creates marketer ratings with the current user as rater', async () => {
    const ratingModel = { create: jest.fn().mockResolvedValue({ _id: 'rating' }) };
    const service = new RatingLeaderboardService(ratingModel as any, {} as any);

    await service.createRating({ marketer: new Types.ObjectId().toString(), ratings: 5 }, { _id: 'rater' });

    expect(ratingModel.create).toHaveBeenCalledWith(expect.objectContaining({ rater: 'rater' }));
  });

  it('returns top three sellers for leaderboard', async () => {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ totalSalesMoney: 10, marketer: { profileImg: 'a.webp' } }]),
    };
    const marketingLogModel = { find: jest.fn().mockReturnValue(chain) };
    const service = new RatingLeaderboardService({} as any, marketingLogModel as any);

    await expect(service.getLeaderBoard()).resolves.toMatchObject({
      status: 'success',
      leaderBoard: { firstRank: { amount: 10 } },
    });
  });

  it('email marketing query enforces max depth before aggregating', async () => {
    const userModel = { aggregate: jest.fn() };
    const service = new UsersService(
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const deepQuery = {
      type: 'not',
      child: { type: 'not', child: { type: 'not', child: { type: 'not', child: { type: 'not', child: { type: 'not', child: { type: 'group', operator: 'AND', children: [] } } } } } },
    };

    await expect(service.queryEmailMarketingUsers({ query: deepQuery })).rejects.toThrow('Email marketing query is too deeply nested');
    expect(userModel.aggregate).not.toHaveBeenCalled();
  });

  it('moves user ownership and transfers market-log sales', async () => {
    const user = { _id: 'user', invitor: 'old', save: jest.fn().mockResolvedValue({}) };
    const exporterLog = { sales: [{ purchaser: { toString: () => 'user' }, amount: 20 }], save: jest.fn().mockResolvedValue({}) };
    const importerLog = { role: 'marketer', sales: [], totalSalesMoney: 0, save: jest.fn().mockResolvedValue({}) };
    const userModel = { findById: jest.fn().mockResolvedValue(user) };
    const marketingLogModel = { findOne: jest.fn().mockResolvedValueOnce(exporterLog).mockResolvedValueOnce(importerLog) };
    const service = new UsersService(
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      marketingLogModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.moveOneUserToAnother({ user: 'user', newInvitor: 'new' });

    expect(importerLog.sales).toHaveLength(1);
    expect(user.invitor).toBe('new');
    expect(marketingLogModel.findOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ marketer: 'old' }),
    );
    expect(marketingLogModel.findOne).toHaveBeenNthCalledWith(2, { marketer: 'new' });
  });
});
