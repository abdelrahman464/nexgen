import { Injectable } from '@nestjs/common';

const pushNotification = require('../../../utils/pushNotification');

@Injectable()
export class PushNotificationService {
  send(...args: unknown[]) {
    if (typeof pushNotification === 'function') return pushNotification(...args);
    if (pushNotification?.sendNotification) return pushNotification.sendNotification(...args);
    throw new Error('Push notification utility is not callable');
  }
}
