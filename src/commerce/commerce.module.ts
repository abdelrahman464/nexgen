import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { ChatSchema } from '../community-realtime/community-realtime.schemas';
import { NotificationSchema } from '../foundation-data/foundation-data.schemas';
import { CourseProgressSchema } from '../learning-catalog/catalog.schemas';
import { LearningCatalogModule } from '../learning-catalog/learning-catalog.module';
import { UserSchema } from '../users/user.schema';
import { CommerceAccessService } from './commerce-access.service';
import { OrdersController, UserSubscriptionsController } from './commerce.controller';
import { OrderSchema, PaymentWebhookEventSchema, UserSubscriptionSchema } from './commerce.schemas';
import { CommerceService } from './commerce.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PaymentProviderService } from './payment-provider.service';
import { WebhookEventService } from './webhook-event.service';

@Module({
  imports: [
    CommonModule,
    LearningCatalogModule,
    MongooseModule.forFeature([
      { name: 'Order', schema: OrderSchema, collection: 'orders' },
      { name: 'UserSubscription', schema: UserSubscriptionSchema, collection: 'usersubscriptions' },
      { name: 'PaymentWebhookEvent', schema: PaymentWebhookEventSchema, collection: 'paymentwebhookevents' },
      { name: 'User', schema: UserSchema, collection: 'users' },
      { name: 'Chat', schema: ChatSchema, collection: 'chats' },
      { name: 'Notification', schema: NotificationSchema, collection: 'notifications' },
      { name: 'CourseProgress', schema: CourseProgressSchema, collection: 'courseprogresses' },
    ]),
  ],
  controllers: [UserSubscriptionsController, OrdersController],
  providers: [CommerceService, CommerceAccessService, OrderFulfillmentService, PaymentProviderService, WebhookEventService],
  exports: [CommerceService, CommerceAccessService, OrderFulfillmentService, PaymentProviderService, WebhookEventService, MongooseModule],
})
export class CommerceModule {}
