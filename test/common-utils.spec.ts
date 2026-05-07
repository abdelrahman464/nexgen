import os from 'os';
import path from 'path';
import { EmailService } from '../src/common/services/email.service';
import { OrderPdfService } from '../src/common/services/order-pdf.service';
import { PushNotificationService } from '../src/common/services/push-notification.service';
import { filterOffensiveWords } from '../src/common/utils/offensive-words.util';
import { wrapUserImageWithServer } from '../src/common/utils/image-url.util';

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
});
