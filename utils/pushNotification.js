const axios = require('axios');

/**
 * Push Notification Service using Firebase Cloud Messaging (FCM) HTTP v1 API
 * 
 * This module sends push notifications to mobile app users via FCM.
 * It uses the legacy FCM HTTP API for compatibility with Node.js 12+.
 */

const FCM_LEGACY_URL = 'https://fcm.googleapis.com/fcm/send';

/**
 * Send push notification to a single device
 * @param {string} fcmToken - The FCM device token
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} FCM response
 */
const sendPushNotification = async (fcmToken, notification, data = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }

  if (!fcmToken) {
    return { success: false, error: 'No FCM token provided' };
  }

  try {
    const message = {
      to: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        sound: 'default',
        ...(notification.image && { image: notification.image }),
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // For Flutter apps
      },
      priority: 'high',
      content_available: true,
    };

    const response = await axios.post(FCM_LEGACY_URL, message, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${process.env.FCM_SERVER_KEY}`,
      },
    });

    if (response.data.success === 1) {
      console.log('Push notification sent successfully');
      return { success: true, data: response.data };
    }
    console.error('Push notification failed:', response.data);
    return { success: false, error: response.data.results };
  } catch (error) {
    console.error('Error sending push notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} fcmTokens - Array of FCM device tokens
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} FCM response
 */
const sendPushNotificationToMultiple = async (fcmTokens, notification, data = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    return { success: false, error: 'No FCM tokens provided' };
  }

  // FCM allows max 1000 tokens per request
  const batchSize = 1000;

  try {
    // Create batches
    const batches = [];
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      batches.push(fcmTokens.slice(i, i + batchSize));
    }

    // Send all batches in parallel
    const batchPromises = batches.map((tokenBatch) => {
      const message = {
        registration_ids: tokenBatch,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          ...(notification.image && { image: notification.image }),
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
        content_available: true,
      };

      return axios.post(FCM_LEGACY_URL, message, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
        },
      });
    });

    const responses = await Promise.all(batchPromises);
    const results = responses.map((r) => r.data);

    const totalSuccess = results.reduce((sum, r) => sum + (r.success || 0), 0);
    const totalFailure = results.reduce((sum, r) => sum + (r.failure || 0), 0);

    console.log(`Push notifications sent: ${totalSuccess} success, ${totalFailure} failure`);

    return {
      success: true,
      totalSuccess,
      totalFailure,
      results,
    };
  } catch (error) {
    console.error('Error sending push notifications:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to a topic (all subscribed users)
 * @param {string} topic - Topic name (e.g., 'all_users', 'new_courses')
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} FCM response
 */
const sendPushNotificationToTopic = async (topic, notification, data = {}) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not configured. Push notification skipped.');
    return { success: false, error: 'FCM_SERVER_KEY not configured' };
  }

  try {
    const message = {
      to: `/topics/${topic}`,
      notification: {
        title: notification.title,
        body: notification.body,
        sound: 'default',
        ...(notification.image && { image: notification.image }),
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      priority: 'high',
      content_available: true,
    };

    const response = await axios.post(FCM_LEGACY_URL, message, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${process.env.FCM_SERVER_KEY}`,
      },
    });

    console.log('Push notification sent to topic:', topic);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending push notification to topic:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to a user (finds their FCM tokens from database)
 * @param {object} User - Mongoose User model
 * @param {string} userId - User ID
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} FCM response
 */
const sendPushNotificationToUser = async (User, userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId).select('fcmTokens');
    
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: false, error: 'No FCM tokens found for user' };
    }

    return await sendPushNotificationToMultiple(user.fcmTokens, notification, data);
  } catch (error) {
    console.error('Error sending push notification to user:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Remove invalid FCM tokens from the database
 * @param {object} User - Mongoose User model  
 * @param {string} userId - User ID
 * @param {string[]} invalidTokens - Array of invalid tokens to remove
 */
const removeInvalidTokens = async (User, userId, invalidTokens) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { $in: invalidTokens } },
    });
    console.log(`Removed ${invalidTokens.length} invalid FCM tokens for user ${userId}`);
  } catch (error) {
    console.error('Error removing invalid FCM tokens:', error.message);
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendPushNotificationToTopic,
  sendPushNotificationToUser,
  removeInvalidTokens,
};

