const express = require('express');

const notificationService = require('../services/notificationService');

const authServices = require('../services/authServices');

const router = express.Router();

router
  .route('/')
  .get(
    authServices.protect,
    notificationService.createFilterObj,
    notificationService.getMyNotifications,
  )
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    notificationService.convertToArray,
    notificationService.sendSystemNotificationToUsers,
  ) //send notification to users
  .put(authServices.protect, notificationService.readAllNotification); //read all
router
  .route('/:id')
  .put(authServices.protect, notificationService.readNotification)
  .delete(authServices.protect, notificationService.deleteNotification);

router
  .route('/unreadCount')
  .get(authServices.protect, notificationService.getUnreadNotificationCount);

//system notification to all users
router.post(
  '/systemNotificationToAll',
  authServices.protect,
  authServices.allowedTo('admin'),
  notificationService.sendSystemNotificationToAll,
);

// Push notification only (without saving to database) - for marketing/broadcast
router.post(
  '/pushOnly',
  authServices.protect,
  authServices.allowedTo('admin'),
  notificationService.sendPushNotificationOnly,
);

module.exports = router;
