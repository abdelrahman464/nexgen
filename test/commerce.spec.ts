import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CommerceAccessService } from '../src/commerce/commerce-access.service';
import { CheckoutCouponDto, PurchaseForUserDto } from '../src/commerce/dto/commerce.dto';
import { OrderFulfillmentService } from '../src/commerce/order-fulfillment.service';
import { PaymentProviderService } from '../src/commerce/payment-provider.service';
import { WebhookEventService } from '../src/commerce/webhook-event.service';

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
    );

    await expect(service.addSubscriberToPackage(packageId, userId)).resolves.toEqual({ subscription: { _id: 'sub' } });
    expect(userSubscriptionModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: userId, package: packageId }));
  });

  it('blocks paid checkout when a recent paid order exists', async () => {
    const orderModel = {
      find: jest.fn().mockResolvedValue([{ createdAt: new Date() }]),
    };
    const service = new CommerceAccessService(orderModel as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.assertNoRecentPaidOrder('66447ad7a7957a07c0ae9e69')).rejects.toThrow(
      'You have already placed an order within the past hour',
    );
  });

  it('uses injected User model when checking marketer order visibility', async () => {
    const orderModel = { countDocuments: jest.fn(), find: jest.fn() };
    const userModel = { exists: jest.fn().mockResolvedValue(null) };
    const service = new CommerceAccessService(orderModel as any, {} as any, {} as any, {} as any, userModel as any);

    await expect(
      service.listOrders({ userId: '66447ad7a7957a07c0ae9e69' }, { _id: '66447ad7a7957a07c0ae9e70', role: 'marketer' }),
    ).rejects.toThrow("You are not authorized to view this user's orders");
    expect(userModel.exists).toHaveBeenCalledWith({
      _id: '66447ad7a7957a07c0ae9e69',
      invitor: '66447ad7a7957a07c0ae9e70',
    });
    expect(orderModel.countDocuments).not.toHaveBeenCalled();
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
    );

    await (service as any).addUserToGroupChatAndNotify('user-id', 'course-id');

    expect(chatModel.findOneAndUpdate).toHaveBeenCalledWith(
      { course: 'course-id', isGroupChat: true },
      { $addToSet: { participants: { user: 'user-id', isAdmin: false } } },
      { new: true },
    );
    expect(notificationModel.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-id', type: 'chat' }));
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
