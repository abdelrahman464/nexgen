import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { CommerceAccessService } from './commerce-access.service';
import { CheckoutCouponDto, OrderItemType, PaymentDetails } from './dto/commerce.dto';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { WebhookEventService } from './webhook-event.service';

const { validateCoupon, canCouponApplyToScope } = require('../../services/couponService');

type CheckoutTarget = {
  type: OrderItemType;
  id: string;
  paramName: string;
};

@Injectable()
export class PaymentProviderService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<any>,
    private readonly access: CommerceAccessService,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly webhookEvents: WebhookEventService,
  ) {}

  async createStripeCheckout(target: CheckoutTarget, user: any, body: CheckoutCouponDto, locale?: string) {
    const item = await this.prepareCheckout(target, user, body);
    const stripe = new Stripe(process.env.STRIPE_SECRET || '', { apiVersion: '2024-06-20' as any });
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            unit_amount: Math.ceil(item.totalOrderPrice * 100),
            currency: 'USD',
            product_data: { name: item.productName },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://nexgen-academy.com/${locale || 'en'}/profile?status=success`,
      cancel_url: `https://nexgen-academy.com/${locale || 'en'}/profile?status=cancelled`,
      customer_email: user.email,
      client_reference_id: target.id,
      metadata: { type: target.type, couponName: body.couponName || null },
    });
    return { status: 'success', session };
  }

  async createPlisioCheckout(target: CheckoutTarget, user: any, body: CheckoutCouponDto) {
    const item = await this.prepareCheckout(target, user, body);
    const response = await axios.get('https://api.plisio.net/api/v1/invoices/new', {
      params: {
        api_key: process.env.PLISIO_SECRET_KEY,
        currency: 'USDT_TRX',
        order_name: target.type,
        order_number: `${target.type.toUpperCase()}_${target.id}_${Date.now()}`,
        amount: item.totalOrderPrice.toFixed(2),
        email: user.email,
        description: `${target.id}|${user.email}|${body.couponName || null}`,
        callback_url: `${process.env.PLISIO_CALLBACK_URL}?json=true`,
      },
    });
    if (response.data.status !== 'success' || !response.data.data?.invoice_url) {
      throw new InternalServerErrorException('Unsuccessful response from Plisio API');
    }
    return { status: 'success', redirectUrl: response.data.data.invoice_url };
  }

  async createLahzaCheckout(target: CheckoutTarget, user: any, body: CheckoutCouponDto) {
    const item = await this.prepareCheckout(target, user, body);
    const response = await axios.post(
      'https://api.lahza.io/transaction/initialize',
      JSON.stringify({
        email: user.email,
        first_name: user.name,
        amount: Math.ceil(item.totalOrderPrice * 100).toString(),
        metadata: { id: target.id, email: user.email, type: target.type, couponName: body.couponName || null },
        currency: 'USD',
      }),
      {
        headers: {
          authorization: `Bearer ${process.env.LAHZA_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return { status: 'success', redirectUrl: response.data.data.authorization_url };
  }

  async handleStripeWebhook(req: Request, res: Response) {
    const stripe = new Stripe(process.env.STRIPE_SECRET || '', { apiVersion: '2024-06-20' as any });
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody || (req.body as any), req.headers['stripe-signature'] as string, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ status: 'success', message: `Event type ${event.type} received but not processed` });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.metadata?.type) return res.status(400).json({ status: 'error', message: 'Missing metadata.type in session' });
    if (!session.client_reference_id || !session.customer_email) return res.status(400).json({ status: 'error', message: 'Missing required fields in session' });

    try {
      await this.webhookEvents.runOnce('stripe', event.id, req.rawBody || req.body, event, async () => {
        await this.fulfillment.fulfillPaidOrder(session.metadata!.type as OrderItemType, {
          id: session.client_reference_id!,
          email: session.customer_email!,
          price: Number(session.amount_total || 0) / 100,
          method: 'stripe',
          couponName: session.metadata?.couponName || null,
        });
      });
      return res.status(200).json({ status: 'success' });
    } catch (error) {
      return res.status(200).json({ status: 'error', message: 'Error processing webhook', error: error instanceof Error ? error.message : String(error) });
    }
  }

  async handlePlisioWebhook(req: Request, res: Response) {
    const payload = this.parseWebhookBody(req);
    if (!payload) return res.status(400).json({ error: 'No payload received' });
    if (!this.verifyPlisioSignature(payload)) return res.status(400).json({ error: 'Invalid signature' });

    const eventId = payload.txn_id || payload.order_number || this.webhookEvents.hashPayload(req.rawBody || payload);
    try {
      if (payload.status === 'completed') {
        await this.webhookEvents.runOnce('plisio', eventId, req.rawBody || payload, payload, async () => {
          const [itemId, userEmail, couponName] = String(payload.order_description || '').split('|');
          const itemType = String(payload.order_name || '').toLowerCase();
          if (!itemId || !itemType || !payload.amount) throw new BadRequestException('Missing required fields');
          await this.fulfillment.fulfillPaidOrder(this.normalizeItemType(itemType), {
            id: itemId,
            email: userEmail,
            price: Number(payload.amount),
            method: 'plisio',
            couponName,
          });
        });
      }
      return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });
    } catch (_error) {
      return res.status(200).json({ status: 'error', message: 'Webhook processed with errors' });
    }
  }

  async handleLahzaWebhook(req: Request, res: Response) {
    const event = this.parseWebhookBody(req);
    if (event.event === 'charge.failed') return res.sendStatus(200);
    if (event.event !== 'charge.success') return res.sendStatus(400);

    const metadata = event.data?.metadata || {};
    const eventId = event.data?.reference || event.data?.id || this.webhookEvents.hashPayload(req.rawBody || event);
    try {
      await this.webhookEvents.runOnce('lahza', eventId, req.rawBody || event, event, async () => {
        await this.fulfillment.fulfillPaidOrder(this.normalizeItemType(metadata.type), {
          id: metadata.id,
          email: metadata.email,
          price: Number(event.data.amount || 0) / 100,
          method: 'lahza',
          couponName: metadata.couponName,
        });
      });
      return res.sendStatus(200);
    } catch (_error) {
      return res.sendStatus(200);
    }
  }

  async handlePlisioCallback(query: Record<string, any>, res: Response) {
    if (query.status === 'success') return res.redirect(`${process.env.FRONTEND_URL}/payment-success`);
    return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
  }

  async handleLahzaCallback(query: Record<string, any>, locale: string | undefined, res: Response) {
    try {
      const response = await axios.get(`https://api.lahza.io/transaction/verify/${query.reference}`, {
        headers: { Authorization: `Bearer ${process.env.LAHZA_SECRET_KEY}` },
      });
      if (response.data.data.status === 'success') return res.redirect(`https://nexgen-academy.com/${locale || 'en'}`);
      return res.redirect(`https://nexgen-academy.com/${locale || 'en'}/error-page`);
    } catch (_error) {
      return res.status(500).json({ error: 'Verification process failed' });
    }
  }

  private async prepareCheckout(target: CheckoutTarget, user: any, body: CheckoutCouponDto) {
    const model = this.access.getModelForType(target.type);
    const item = await model.findById(target.id);
    if (!item) throw new NotFoundException(`There's no ${target.type}`);
    if (target.type === 'course') {
      await this.access.assertCourseCanBePurchased(user, target.id);
    }
    let totalOrderPrice = item.priceAfterDiscount || item.price;
    if (body.couponName) {
      const coupon = await validateCoupon(body.couponName, user.invitor);
      if (typeof coupon === 'string') throw new BadRequestException(coupon);
      const scopeValidation = canCouponApplyToScope(coupon, target.type, target.id);
      if (!scopeValidation.canApply) throw new BadRequestException(scopeValidation.errorMessage);
      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }
    return {
      item,
      totalOrderPrice: Number(totalOrderPrice),
      productName: item.title?.en || item.title?.ar || target.type,
    };
  }

  private verifyPlisioSignature(data: Record<string, any>) {
    if (!data || typeof data !== 'object' || !data.verify_hash) return false;
    const ordered = { ...data };
    delete ordered.verify_hash;
    const hash = crypto.createHmac('sha1', process.env.PLISIO_SECRET_KEY || '').update(JSON.stringify(ordered)).digest('hex');
    return hash === data.verify_hash;
  }

  private normalizeItemType(type: string): OrderItemType {
    const normalized = String(type).toLowerCase();
    if (normalized === 'course') return 'course';
    if (normalized === 'package') return 'package';
    if (normalized === 'coursepackage') return 'coursePackage';
    throw new BadRequestException(`Unknown order type: ${type}`);
  }

  private parseWebhookBody(req: Request) {
    const body = req.body;
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
    if (typeof body === 'string') return JSON.parse(body);
    return body;
  }
}
