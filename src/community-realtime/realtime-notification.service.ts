import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { registerRealtimeNotificationListener } from '../common/utils/realtime-notification-bus.util';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeNotificationService implements OnModuleInit, OnModuleDestroy {
  private unregisterListener?: () => void;

  constructor(@Optional() private readonly gateway?: RealtimeGateway) {}

  onModuleInit() {
    this.unregisterListener = registerRealtimeNotificationListener(({ userId, payload }) => {
      this.sendNotification(userId, payload);
    });
  }

  onModuleDestroy() {
    this.unregisterListener?.();
    this.unregisterListener = undefined;
  }

  sendNotification(userId: string, notificationData: any) {
    this.gateway?.sendNotification(userId, notificationData);
  }
}
