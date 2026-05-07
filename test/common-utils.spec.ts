import os from 'os';
import path from 'path';
import { EmailService } from '../src/common/services/email.service';
import { OrderPdfService } from '../src/common/services/order-pdf.service';
import { PushNotificationService } from '../src/common/services/push-notification.service';
import { filterOffensiveWords } from '../src/common/utils/offensive-words.util';
import { wrapUserImageWithServer } from '../src/common/utils/image-url.util';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import * as runtimeModels from '../src/common/utils/runtime-models.util';
import { backfillModelOrder } from '../scripts/backfillItemOrder';
import fs from 'fs';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('pdfkit', () =>
  jest.fn().mockImplementation(() => {
    const doc: any = {
      y: 100,
      pipe: jest.fn((stream) => {
        doc.stream = stream;
        return stream;
      }),
      image: jest.fn(() => doc),
      fillColor: jest.fn(() => doc),
      fontSize: jest.fn(() => doc),
      text: jest.fn(() => doc),
      moveDown: jest.fn(() => doc),
      moveTo: jest.fn(() => doc),
      lineTo: jest.fn(() => doc),
      stroke: jest.fn(() => doc),
      end: jest.fn(() => doc.stream?.end()),
    };
    return doc;
  }),
);

describe('Common utility ports', () => {
  const nodemailer = require('nodemailer');
  const axios = require('axios');

  beforeEach(() => {
    jest.clearAllMocks();
    nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) });
    delete process.env.FCM_SERVER_KEY;
    process.env.BASE_URL = 'https://api.example.test';
  });

  it('generates order PDF paths in the existing uploads/orders format', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(12345);
    const outputDirectory = path.join(os.tmpdir(), `nexgen-order-pdfs-${Date.now()}`);
    const service = new OrderPdfService();

    await expect(
      service.generateOrderPDF(
        {
          _id: 'order-id',
          user: { name: 'Buyer', email: 'buyer@example.com' },
          package: { title: { en: 'Package' }, price: 10 },
          totalOrderPrice: 10,
          paymentMethodType: 'stripe',
          isPaid: true,
          paidAt: new Date('2026-05-07T00:00:00Z'),
        },
        { outputDirectory },
      ),
    ).resolves.toBe(path.join(outputDirectory, 'order-order-id-12345.pdf'));
    jest.restoreAllMocks();
  });

  it('uses the moved assets logo as the default order PDF logo path', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(12345);
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const outputDirectory = path.join(os.tmpdir(), `nexgen-order-pdfs-${Date.now()}`);
    const service = new OrderPdfService();

    await service.generateOrderPDF(
      {
        _id: 'order-id',
        user: { name: 'Buyer', email: 'buyer@example.com' },
        totalOrderPrice: 10,
        paymentMethodType: 'stripe',
        isPaid: true,
      },
      { outputDirectory },
    );

    expect(existsSpy).toHaveBeenCalledWith(path.join(process.cwd(), 'assets', 'iconicLogo.png'));
    jest.restoreAllMocks();
  });

  it('sends emails with the existing SMTP env and html mail shape', async () => {
    process.env.EMAIL_HOST = 'smtp.example.test';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_USER = 'noreply@example.test';
    process.env.EMAIL_PASSWORD = 'secret';
    process.env.EMAIL_FROM = 'Nexgen';

    await new EmailService().send({ to: 'user@example.test', subject: 'Hello', html: '<p>Hello</p>' });

    const sendMail = nodemailer.createTransport.mock.results[0].value.sendMail;
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: '465',
      secure: true,
      auth: { user: 'noreply@example.test', pass: 'secret' },
      sender: { name: 'Nexgen' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'Nexgen', address: 'noreply@example.test' },
      to: 'user@example.test',
      subject: 'Hello',
      html: '<p>Hello</p>',
    });
  });

  it('preserves push skip and FCM batching behavior', async () => {
    const service = new PushNotificationService();

    await expect(service.sendToMultiple(['a'], { title: 'T', body: 'B' })).resolves.toEqual({
      success: false,
      error: 'FCM_SERVER_KEY not configured',
    });

    process.env.FCM_SERVER_KEY = 'server-key';
    axios.post.mockResolvedValue({ data: { success: 1, failure: 0 } });
    const tokens = Array.from({ length: 1001 }, (_, index) => `token-${index}`);

    await service.sendToMultiple(tokens, { title: 'Title', body: 'Body' }, { type: 'system' });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/fcm/send',
      expect.objectContaining({
        registration_ids: tokens.slice(0, 1000),
        notification: expect.objectContaining({ title: 'Title', body: 'Body', sound: 'default' }),
        data: expect.objectContaining({ type: 'system', click_action: 'FLUTTER_NOTIFICATION_CLICK' }),
      }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'key=server-key' }) }),
    );
  });

  it('preserves offensive-word filtering and image URL wrapping behavior', () => {
    expect(filterOffensiveWords('badword clean', ['badword'])).toBe('*** clean');
    expect(filterOffensiveWords('b-a-d-word clean', ['badword'])).toBe('***clean');
    expect(filterOffensiveWords('b4dword clean', ['b4dword'])).toBe('*** clean');
    expect(filterOffensiveWords(42 as any)).toBe(42);
    expect(wrapUserImageWithServer('avatar.webp')).toBe('https://api.example.test/users/avatar.webp');
  });

  it('logs global exceptions through the typed runtime error model helper', async () => {
    process.env.SKIP_DB_CONNECTION = 'false';
    process.env.NODE_ENV = 'development';
    const logSpy = jest.spyOn(runtimeModels, 'logRuntimeErrorToDatabase').mockResolvedValue(undefined);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/test' }),
        getResponse: () => response,
      }),
    };

    await new GlobalExceptionFilter().catch(new Error('boom'), host);

    expect(logSpy).toHaveBeenCalledWith(expect.any(Error), 'GET /api/v1/test');
    expect(response.status).toHaveBeenCalledWith(500);
    delete process.env.SKIP_DB_CONNECTION;
  });

  it('skips global exception DB logging when database connections are disabled', async () => {
    process.env.SKIP_DB_CONNECTION = 'true';
    const logSpy = jest.spyOn(runtimeModels, 'logRuntimeErrorToDatabase').mockResolvedValue(undefined);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/test' }),
        getResponse: () => response,
      }),
    };

    await new GlobalExceptionFilter().catch(new Error('boom'), host);

    expect(logSpy).not.toHaveBeenCalled();
    delete process.env.SKIP_DB_CONNECTION;
  });

  it('backfills item order with the existing ordering behavior', async () => {
    const chain = (result: any) => ({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      setOptions: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    });
    const Model = {
      findOne: jest.fn().mockReturnValue(chain({ order: 5 })),
      find: jest.fn().mockReturnValue(chain([{ _id: 'a' }, { _id: 'b' }])),
      bulkWrite: jest.fn().mockResolvedValue({}),
    };

    await expect(backfillModelOrder({ name: 'Course', Model })).resolves.toEqual({
      name: 'Course',
      backfilledCount: 2,
    });
    expect(Model.bulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: 'a' }, update: { $set: { order: 6 } } } },
      { updateOne: { filter: { _id: 'b' }, update: { $set: { order: 7 } } } },
    ]);
  });

  it('supports dry-run item order backfill without writing updates', async () => {
    const chain = (result: any) => ({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      setOptions: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    });
    const Model = {
      findOne: jest.fn().mockReturnValue(chain(null)),
      find: jest.fn().mockReturnValue(chain([{ _id: 'a' }])),
      bulkWrite: jest.fn(),
    };

    await expect(backfillModelOrder({ name: 'Package', Model }, true)).resolves.toEqual({
      name: 'Package',
      backfilledCount: 1,
    });
    expect(Model.bulkWrite).not.toHaveBeenCalled();
  });
});
