import { Injectable } from '@nestjs/common';

const axios = require('axios');

const FCM_LEGACY_URL = 'https://fcm.googleapis.com/fcm/send';

export interface PushNotificationPayload {
  title: string;
  body: string;
  image?: string;
}

export const sendPushNotification = async (fcmToken: string, notification: PushNotificationPayload, data: Record<string, any> = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }
  if (!fcmToken) return { success: false, error: 'No FCM token provided' };

  try {
    const response = await axios.post(
      FCM_LEGACY_URL,
      {
        to: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          ...(notification.image && { image: notification.image }),
        },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        priority: 'high',
        content_available: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
        },
      },
    );
    if (response.data.success === 1) {
      console.log('Push notification sent successfully');
      return { success: true, data: response.data };
    }
    console.error('Push notification failed:', response.data);
    return { success: false, error: response.data.results };
  } catch (error: any) {
    console.error('Error sending push notification:', error.message);
    return { success: false, error: error.message };
  }
};

export const sendPushNotificationToMultiple = async (fcmTokens: string[], notification: PushNotificationPayload, data: Record<string, any> = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }
  if (!fcmTokens || fcmTokens.length === 0) return { success: false, error: 'No FCM tokens provided' };

  const batchSize = 1000;
  try {
    const batches: string[][] = [];
    for (let i = 0; i < fcmTokens.length; i += batchSize) batches.push(fcmTokens.slice(i, i + batchSize));
    const responses = await Promise.all(
      batches.map((tokenBatch) =>
        axios.post(
          FCM_LEGACY_URL,
          {
            registration_ids: tokenBatch,
            notification: {
              title: notification.title,
              body: notification.body,
              sound: 'default',
              ...(notification.image && { image: notification.image }),
            },
            data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
            priority: 'high',
            content_available: true,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${process.env.FCM_SERVER_KEY}`,
            },
          },
        ),
      ),
    );
    const results = responses.map((response: any) => response.data);
    const totalSuccess = results.reduce((sum: number, result: any) => sum + (result.success || 0), 0);
    const totalFailure = results.reduce((sum: number, result: any) => sum + (result.failure || 0), 0);
    console.log(`Push notifications sent: ${totalSuccess} success, ${totalFailure} failure`);
    return { success: true, totalSuccess, totalFailure, results };
  } catch (error: any) {
    console.error('Error sending push notifications:', error.message);
    return { success: false, error: error.message };
  }
};

export const sendPushNotificationToTopic = async (topic: string, notification: PushNotificationPayload, data: Record<string, any> = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }
  try {
    const response = await axios.post(
      FCM_LEGACY_URL,
      {
        to: `/topics/${topic}`,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          ...(notification.image && { image: notification.image }),
        },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        priority: 'high',
        content_available: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
        },
      },
    );
    console.log('Push notification sent to topic:', topic);
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error('Error sending push notification to topic:', error.message);
    return { success: false, error: error.message };
  }
};

export const sendPushNotificationToUser = async (User: any, userId: string, notification: PushNotificationPayload, data: Record<string, any> = {}) => {
  try {
    const user = await User.findById(userId).select('fcmTokens');
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: false, error: 'No FCM tokens found for user' };
    }
    return sendPushNotificationToMultiple(user.fcmTokens, notification, data);
  } catch (error: any) {
    console.error('Error sending push notification to user:', error.message);
    return { success: false, error: error.message };
  }
};

export const removeInvalidTokens = async (User: any, userId: string, invalidTokens: string[]) => {
  try {
    await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: { $in: invalidTokens } } });
    console.log(`Removed ${invalidTokens.length} invalid FCM tokens for user ${userId}`);
  } catch (error: any) {
    console.error('Error removing invalid FCM tokens:', error.message);
  }
};

@Injectable()
export class PushNotificationService {
  send = sendPushNotification;
  sendToMultiple = sendPushNotificationToMultiple;
  sendToTopic = sendPushNotificationToTopic;
  sendToUser = sendPushNotificationToUser;
  removeInvalidTokens = removeInvalidTokens;
}
