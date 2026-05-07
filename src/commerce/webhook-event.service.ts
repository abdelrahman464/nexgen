import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class WebhookEventService {
  constructor(@InjectModel('PaymentWebhookEvent') private readonly eventModel: Model<any>) {}

  hashPayload(payload: unknown) {
    const value = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload || {}));
    return createHash('sha256').update(value).digest('hex');
  }

  async runOnce<T>(provider: 'stripe' | 'plisio' | 'lahza', eventId: string, rawPayload: unknown, payload: unknown, handler: () => Promise<T>) {
    const rawHash = this.hashPayload(rawPayload);
    const event = await this.eventModel.findOneAndUpdate(
      { provider, eventId },
      { $setOnInsert: { provider, eventId, rawHash, payload, status: 'received' } },
      { new: true, upsert: true, rawResult: true },
    );
    const lastErrorObject = event?.lastErrorObject;
    const document = event?.value || event;
    if (lastErrorObject && !lastErrorObject.updatedExisting) {
      try {
        const result = await handler();
        await this.eventModel.findByIdAndUpdate(document._id, { status: 'processed', processedAt: new Date() });
        return { duplicate: false, result };
      } catch (error) {
        await this.eventModel.findByIdAndUpdate(document._id, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    if (document?.status === 'processed') return { duplicate: true, result: null };
    return { duplicate: true, result: null };
  }
}
