import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CommerceAccessService } from '../src/commerce/commerce-access.service';
import { CheckoutCouponDto, PurchaseForUserDto } from '../src/commerce/dto/commerce.dto';
import { OrderCommissionService } from '../src/commerce/order-commission.service';
import { OrderFulfillmentService } from '../src/commerce/order-fulfillment.service';
import { PaymentProviderService } from '../src/commerce/payment-provider.service';
import { SubscriptionMaintenanceService } from '../src/commerce/subscription-maintenance.service';
import { WebhookEventService } from '../src/commerce/webhook-event.service';
import { CouponRulesService } from '../src/foundation-data/coupon-rules.service';

const createResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('Commerce migration smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid manual purchase DTO input', async () => {
    const dto = Object.assign(new PurchaseForUserDto(), {
      id: 'bad-id',
      type: 'bad-type',
      userId: 'bad-user',
      isPaid: 'yes',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['id', 'type', 'userId', 'isPaid']));
  });

  it('accepts optional checkout coupon bodies', async () => {
    const dto = Object.assign(new CheckoutCouponDto(), {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('filters user subscriptions by current user when listing', async () => {
    const model = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'sub' }]),
      }),
    };
    const { CommerceService } = await import('../src/commerce/commerce.service');
    const service = new CommerceService(
      {} as any,
      model as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getMySubscriptions({}, { _id: '66447ad7a7957a07c0ae9e69' });

    expect(model.countDocuments).toHaveBeenCalledWith({ user: '66447ad7a7957a07c0ae9e69' });
  });

  it('creates admin package subscriptions with legacy response shape', async () => {
    const packageId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();
    const packageModel = { findById: jest.fn().mockResolvedValue({ subscriptionDurationDays: 30 }) };
    const userSubscriptionModel = { create: jest.fn().mockResolvedValue({ _id: 'sub' }) };
    const service = new OrderFulfillmentService(
      {} as any,
      {} as any,
      packageModel as any,
      {} as any,
      {} as any,
      userSubscriptionModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.addSubscriberToPackage(packageId, userId)).resolves.toEqual({ subscription: { _id: 'sub' } });
    expect(userSubscriptionModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: userId, package: packageId }));
  });

  it('blocks paid checkout when a recent paid order exists', async () => {
    const orderModel = {
      find: jest.fn().mockResolvedValue([{ createdAt: new Date() }]),
    };
    const service = new CommerceAccessService(orderModel as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.assertNoRecentPaidOrder('66447ad7a7957a07c0ae9e69')).rejects.toThrow(
      'You have already placed an order within the past hour',
    );
  });

  it('uses injected User model when checking marketer order visibility', async () => {
    const orderModel = { countDocuments: jest.fn(), find: jest.fn() };
    const userModel = { exists: jest.fn().mockResolvedValue(null) };
    const service = new CommerceAccessService(orderModel as any, {} as any, {} as any, {} as any, userModel as any, {} as any);

    await expect(
      service.listOrders({ userId: '66447ad7a7957a07c0ae9e69' }, { _id: '66447ad7a7957a07c0ae9e70', role: 'marketer' }),
    ).rejects.toThrow("You are not authorized to view this user's orders");
    expect(userModel.exists).toHaveBeenCalledWith({
      _id: '66447ad7a7957a07c0ae9e69',
      invitor: '66447ad7a7957a07c0ae9e70',
    });
    expect(orderModel.countDocuments).not.toHaveBeenCalled();
  });

  it('allows open courses to be purchased when no existing order exists', async () => {
    const courseId = new Types.ObjectId().toString();
    const orderModel = { findOne: jest.fn().mockResolvedValue(null) };
    const courseModel = { findById: jest.fn().mockResolvedValue({ needAccessibleCourse: false, accessibleCourses: [] }) };
    const courseProgressModel = { find: jest.fn() };
    const service = new CommerceAccessService(orderModel as any, courseModel as any, {} as any, {} as any, {} as any, courseProgressModel as any);

    await expect(service.assertCourseCanBePurchased({ _id: 'user-id' }, courseId)).resolves.toBeUndefined();

    expect(courseModel.findById).toHaveBeenCalledWith(courseId);
    expect(courseProgressModel.find).not.toHaveBeenCalled();
    expect(orderModel.findOne).toHaveBeenCalledWith({ user: 'user-id', course: courseId });
  });

  it('rejects missing courses with the legacy course not found message', async () => {
    const courseModel = { findById: jest.fn().mockResolvedValue(null) };
    const service = new CommerceAccessService({} as any, courseModel as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.assertCourseCanBePurchased({ _id: 'user-id' }, 'missing-course')).rejects.toThrow('course Not Found');
  });

  it('allows locked courses when placement course grants access', async () => {
    const courseId = new Types.ObjectId().toString();
    const placementCourseId = new Types.ObjectId().toString();
    const orderModel = { findOne: jest.fn().mockResolvedValue(null) };
    const courseModel = {
      findById: jest.fn().mockResolvedValue({ needAccessibleCourse: true, accessibleCourses: [new Types.ObjectId()] }),
      findOne: jest.fn().mockResolvedValue({ accessibleCourses: [courseId] }),
    };
    const courseProgressModel = { find: jest.fn() };
    const service = new CommerceAccessService(orderModel as any, courseModel as any, {} as any, {} as any, {} as any, courseProgressModel as any);

    await expect(
      service.assertCourseCanBePurchased({ _id: 'user-id', placementExam: { course: placementCourseId } }, courseId),
    ).resolves.toBeUndefined();

    expect(courseModel.findOne).toHaveBeenCalledWith({ _id: placementCourseId });
    expect(courseProgressModel.find).not.toHaveBeenCalled();
  });

  it('allows locked courses when completed prerequisite progress grants access', async () => {
    const courseId = new Types.ObjectId().toString();
    const prerequisiteId = new Types.ObjectId();
    const orderModel = { findOne: jest.fn().mockResolvedValue(null) };
    const courseModel = {
      findById: jest.fn().mockResolvedValue({ needAccessibleCourse: true, accessibleCourses: [prerequisiteId] }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const courseProgressModel = { find: jest.fn().mockResolvedValue([{ course: prerequisiteId.toString() }]) };
    const service = new CommerceAccessService(orderModel as any, courseModel as any, {} as any, {} as any, {} as any, courseProgressModel as any);

    await expect(service.assertCourseCanBePurchased({ _id: 'user-id' }, courseId)).resolves.toBeUndefined();

    expect(courseProgressModel.find).toHaveBeenCalledWith({ user: 'user-id', status: 'Completed' });
  });

  it('rejects locked courses when no placement or progress grants access', async () => {
    const courseId = new Types.ObjectId().toString();
    const prerequisiteId = new Types.ObjectId();
    const courseModel = {
      findById: jest.fn().mockResolvedValue({ needAccessibleCourse: true, accessibleCourses: [prerequisiteId] }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const courseProgressModel = { find: jest.fn().mockResolvedValue([]) };
    const service = new CommerceAccessService({} as any, courseModel as any, {} as any, {} as any, {} as any, courseProgressModel as any);

    await expect(service.assertCourseCanBePurchased({ _id: 'user-id' }, courseId)).rejects.toThrow(
      'Access Denied: You may need to complete the basics or succeed in placement exam',
    );
  });

  it('keeps duplicate order blocking after course access passes', async () => {
    const courseId = new Types.ObjectId().toString();
    const orderModel = { findOne: jest.fn().mockResolvedValue({ _id: 'existing-order' }) };
    const courseModel = { findById: jest.fn().mockResolvedValue({ needAccessibleCourse: false, accessibleCourses: [] }) };
    const service = new CommerceAccessService(orderModel as any, courseModel as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.assertCourseCanBePurchased({ _id: 'user-id' }, courseId)).rejects.toThrow('You already bought this course');
  });

  it('uses injected chat and notification models when enrolling users into group chats', async () => {
    const chatModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({ groupName: 'Course group' }),
    };
    const notificationModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new OrderFulfillmentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      chatModel as any,
      notificationModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await (service as any).addUserToGroupChatAndNotify('user-id', 'course-id');

    expect(chatModel.findOneAndUpdate).toHaveBeenCalledWith(
      { course: 'course-id', isGroupChat: true },
      { $addToSet: { participants: { user: 'user-id', isAdmin: false } } },
      { new: true },
    );
    expect(notificationModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-id', type: 'chat' }));
  });

  it('validates coupon rules with legacy strings and item scopes', async () => {
    const coupon = {
      couponName: 'SAVE',
      status: 'active',
      maxUsageTimes: 10,
      usedTimes: 1,
      isAdminCoupon: false,
      marketer: { _id: 'marketer-id' },
      courses: ['course-id'],
      packages: [],
      coursePackages: [],
      discount: 20,
    };
    const couponModel = { findOne: jest.fn().mockResolvedValue(coupon) };
    const service = new CouponRulesService(couponModel as any);

    await expect(service.validateCoupon('SAVE', 'marketer-id')).resolves.toBe(coupon);
    expect(service.canCouponApplyToScope(coupon, 'course', 'course-id')).toEqual({ canApply: true, errorMessage: null });
    expect(service.canCouponApplyToScope(coupon, 'course', 'other-course')).toEqual({
      canApply: false,
      errorMessage: 'This coupon cannot be used for this course',
    });
  });

  it('keeps rejected and unauthorized coupon validation messages', async () => {
    const couponModel = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ status: 'rejected' })
        .mockResolvedValueOnce({
          status: 'active',
          maxUsageTimes: 10,
          usedTimes: 0,
          isAdminCoupon: false,
          marketer: { _id: 'owner-id' },
        }),
    };
    const service = new CouponRulesService(couponModel as any);

    await expect(service.validateCoupon('BAD', 'owner-id')).resolves.toBe('coupon-errors.unActive');
    await expect(service.validateCoupon('SAVE', 'other-id')).resolves.toBe('coupon-errors.Un-Authorized');
  });

  it('uses typed coupon service when preparing checkout discounts', async () => {
    const access = {
      getModelForType: jest.fn().mockReturnValue({ findById: jest.fn().mockResolvedValue({ price: 100, title: { en: 'Course' } }) }),
      assertCourseCanBePurchased: jest.fn().mockResolvedValue(undefined),
    };
    const coupons = {
      validateCoupon: jest.fn().mockResolvedValue({ discount: 25, courses: ['course-id'] }),
      canCouponApplyToScope: jest.fn().mockReturnValue({ canApply: true }),
    };
    const service = new PaymentProviderService({} as any, access as any, {} as any, {} as any, coupons as any);

    await expect((service as any).prepareCheckout({ type: 'course', id: 'course-id' }, { invitor: 'marketer' }, { couponName: 'SAVE' })).resolves.toMatchObject({
      totalOrderPrice: 75,
    });
  });

  it('marks users as available to review through the injected User model', async () => {
    const userModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    const service = new OrderFulfillmentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await (service as any).markUserAvailableToReview('user-id');

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith({ _id: 'user-id', authToReview: false }, { authToReview: true });
  });

  it('calculates order commissions and updates instructor, seller, head, and marketing chat side effects', async () => {
    const marketerLog: any = {
      marketer: 'seller-id',
      invitor: 'head-id',
      profitableItems: [{ itemId: 'course-id', itemType: 'course', percentage: 10 }],
    };
    const headLog: any = {
      marketer: 'head-id',
      invitor: 'root-id',
      profits: 0,
      commissionsProfits: 0,
      totalProfits: 0,
      commissions: [],
      profitableItems: [{ itemId: 'course-id', itemType: 'course', percentage: 20 }],
      save: jest.fn(),
    };
    const userModel = { findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'buyer-id', invitor: 'seller-id' }) }) };
    const marketingLogModel = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(marketerLog)
        .mockResolvedValueOnce(headLog)
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(marketerLog) })
        .mockResolvedValueOnce(headLog),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const instructorProfitsModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const orderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const chatModel = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'chat-id' }) };
    const notificationModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new OrderCommissionService(
      userModel as any,
      marketingLogModel as any,
      instructorProfitsModel as any,
      orderModel as any,
      chatModel as any,
      notificationModel as any,
    );

    await service.handleOrderCommissions(
      { _id: 'course-id', instructorPercentage: 50, instructor: 'instructor-id' },
      { email: 'buyer@example.com', invitor: 'seller-id', amount: 100, itemType: 'course', order: 'order-id', item: { en: 'Course' } },
    );

    expect(instructorProfitsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { instructor: 'instructor-id' },
      expect.objectContaining({ $inc: expect.objectContaining({ profits: 40, totalSalesMoney: 100 }) }),
    );
    expect(marketingLogModel.findOneAndUpdate).toHaveBeenCalledWith(
      { marketer: 'seller-id' },
      expect.objectContaining({ $inc: expect.objectContaining({ totalSalesMoney: 100, profits: 5 }) }),
    );
    expect(chatModel.findOneAndUpdate).toHaveBeenCalledWith(
      { creator: 'seller-id', type: 'marketingTeam' },
      { $addToSet: { participants: { user: 'buyer-id' } } },
      { new: true },
    );
    expect(notificationModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'buyer-id', type: 'chat' }));
  });

  it('removes expired non-admin subscribers from matching chats and creates notifications', async () => {
    const userId = new Types.ObjectId();
    const courseId = new Types.ObjectId();
    const subscription = {
      _id: 'subscription-id',
      user: { _id: userId, invitor: 'marketer-id' },
      package: { course: { _id: courseId } },
    };
    const subscriptionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([subscription]),
      }),
    };
    const chatModel = {
      find: jest.fn().mockResolvedValue([
        { _id: 'chat-id', groupName: 'Course group', participants: [{ user: userId, isAdmin: false }] },
      ]),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const notificationModel = { create: jest.fn().mockResolvedValue({}) };
    const service = new SubscriptionMaintenanceService(subscriptionModel as any, chatModel as any, notificationModel as any);

    await expect(service.kickUnsubscribedUsersJob(new Date('2026-05-07'))).resolves.toEqual({ success: true, processedCount: 1 });

    expect(subscriptionModel.find).toHaveBeenCalledWith({ endDate: { $lt: new Date('2026-05-07') } });
    expect(chatModel.find).toHaveBeenCalledWith({
      $or: [{ course: courseId }, { creator: 'marketer-id' }],
      'participants.user': userId,
    });
    expect(chatModel.updateOne).toHaveBeenCalledWith({ _id: 'chat-id' }, { $pull: { participants: { user: userId } } });
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: userId,
        type: 'system',
        message: expect.objectContaining({ en: 'You have been removed from the group Course group' }),
      }),
    );
  });

  it('skips admin participants when expired subscriptions are cleaned up', async () => {
    const userId = new Types.ObjectId();
    const subscriptionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([{ _id: 'sub', user: { _id: userId }, package: { course: { _id: new Types.ObjectId() } } }]),
      }),
    };
    const chatModel = {
      find: jest.fn().mockResolvedValue([{ _id: 'chat', participants: [{ user: userId, isAdmin: true }] }]),
      updateOne: jest.fn(),
    };
    const notificationModel = { create: jest.fn() };
    const service = new SubscriptionMaintenanceService(subscriptionModel as any, chatModel as any, notificationModel as any);

    await expect(service.kickUnsubscribedUsersJob()).resolves.toEqual({ success: true, processedCount: 0 });

    expect(chatModel.updateOne).not.toHaveBeenCalled();
    expect(notificationModel.create).not.toHaveBeenCalled();
  });

  it('skips expired subscriptions with missing user or package course', async () => {
    const subscriptionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([
          { _id: 'missing-user', user: null, package: { course: { _id: 'course' } } },
          { _id: 'missing-course', user: { _id: 'user' }, package: {} },
        ]),
      }),
    };
    const chatModel = { find: jest.fn(), updateOne: jest.fn() };
    const notificationModel = { create: jest.fn() };
    const service = new SubscriptionMaintenanceService(subscriptionModel as any, chatModel as any, notificationModel as any);

    await expect(service.kickUnsubscribedUsersJob()).resolves.toEqual({ success: true, processedCount: 0 });

    expect(chatModel.find).not.toHaveBeenCalled();
    expect(notificationModel.create).not.toHaveBeenCalled();
  });

  it('returns success when expired subscriptions have no matching chats', async () => {
    const subscriptionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([{ _id: 'sub', user: { _id: 'user' }, package: { course: { _id: 'course' } } }]),
      }),
    };
    const chatModel = { find: jest.fn().mockResolvedValue([]), updateOne: jest.fn() };
    const notificationModel = { create: jest.fn() };
    const service = new SubscriptionMaintenanceService(subscriptionModel as any, chatModel as any, notificationModel as any);

    await expect(service.kickUnsubscribedUsersJob()).resolves.toEqual({ success: true, processedCount: 0 });
  });

  it('runs the scheduled subscription cleanup through the shared typed job', async () => {
    const service = new SubscriptionMaintenanceService({} as any, {} as any, {} as any);
    const spy = jest.spyOn(service, 'kickUnsubscribedUsersJob').mockResolvedValue({ success: true, processedCount: 2 });

    await expect(service.kickUnsubscribedUsersCron()).resolves.toEqual({ success: true, processedCount: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('processes webhook event only once', async () => {
    const inserted = { _id: 'event', status: 'received' };
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValueOnce({ lastErrorObject: { updatedExisting: false }, value: inserted }).mockResolvedValueOnce({
        lastErrorObject: { updatedExisting: true },
        value: { ...inserted, status: 'processed' },
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const service = new WebhookEventService(model as any);
    const handler = jest.fn().mockResolvedValue('ok');

    await expect(service.runOnce('stripe', 'evt_1', Buffer.from('a'), { id: 'evt_1' }, handler)).resolves.toMatchObject({ duplicate: false });
    await expect(service.runOnce('stripe', 'evt_1', Buffer.from('a'), { id: 'evt_1' }, handler)).resolves.toMatchObject({ duplicate: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('acknowledges failed Lahza payments without fulfillment', async () => {
    const service = new PaymentProviderService(
      {} as any,
      {} as any,
      { fulfillPaidOrder: jest.fn() } as any,
      {} as any,
      {} as any,
    );
    const res = createResponse();

    await service.handleLahzaWebhook({ body: { event: 'charge.failed', data: { reference: 'ref' } } } as any, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('parses raw Lahza webhook buffers while preserving raw-body support', async () => {
    const service = new PaymentProviderService(
      {} as any,
      {} as any,
      { fulfillPaidOrder: jest.fn() } as any,
      {} as any,
      {} as any,
    );
    const res = createResponse();

    await service.handleLahzaWebhook({ body: Buffer.from(JSON.stringify({ event: 'charge.failed', data: { reference: 'ref' } })) } as any, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('keeps raw body available for webhook idempotency hashes', () => {
    const service = new WebhookEventService({} as any);
    const hash = service.hashPayload(Buffer.from('signed-payload'));

    expect(hash).toHaveLength(64);
  });
});
