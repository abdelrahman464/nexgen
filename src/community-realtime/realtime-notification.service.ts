import { Injectable, Optional } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeNotificationService {
  constructor(@Optional() private readonly gateway?: RealtimeGateway) {}

  sendNotification(userId: string, notificationData: any) {
    this.gateway?.sendNotification(userId, notificationData);
  }
}
