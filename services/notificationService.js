const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const factory = require('./handllerFactory');

exports.createFilterObj = (req, res, next) => {
  const filterObject = { user: req.user._id };
  req.filterObj = filterObject;
  next();
};
exports.convertToArray = (req, res, next) => {
  if (req.body.users) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.users)) {
      req.body.users = [req.body.users];
    }
  }
  next();
};
//@desc create system notification to specific users
//@route Post /api/v1/notifications
//@access private
exports.sendSystemNotificationToUsers = asyncHandler(async (req, res, next) => {
  const { users, message } = req.body; //array of users
  // Create notifications for users
  await Promise.all(
    users.map(async (user) => {
      await Notification.create({
        user,
        message,
        type: 'system',
      });
    }),
  );

  // Respond with success message
  res.status(201).json({
    status: 'success',
    message: 'Notifications sent successfully',
  });
});

//@desc get list of notifications
//@route GET /api/v1/notifications
//@access private
exports.getMyNotifications = factory.getALl(Notification, 'Notification');
//@desc delete notification
//@route DELETE /api/v1/notifications/:id
//@access private
exports.deleteNotification = factory.deleteOne(Notification);
//@desc read notification
//@route Put /api/v1/notifications/:id
//@access private
exports.readNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    {
      new: true,
      runValidators: true,
    },
  );
  if (!notification) {
    return next(new ApiError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'notification read',
  });
});
//@desc read all notification
//@route Put /api/v1/notifications/readAll
//@access private
exports.readAllNotification = asyncHandler(async (req, res, next) => {
  await Notification.updateMany({ user: req.user._id }, { read: true });
  res.status(200).json({
    status: 'success',
    message: 'All notification read',
  });
});
//@desc get unread notification count
//@route Put /api/v1/notifications/unreadCount
//@access private
exports.getUnreadNotificationCount = asyncHandler(async (req, res, next) => {
  const count = await Notification.countDocuments({
    user: req.user._id,
    read: false,
  });
  res.status(200).json({
    count,
  });
});
//@desc create system notification to all users
//@route Post /api/v1/notifications/systemNotificationToAll
//@access private
exports.sendSystemNotificationToAll = asyncHandler(async (req, res, next) => {
  const users = await User.find({ role: 'user' });
  const { message } = req.body;
  // Create notifications for users
  await Promise.all(
    users.map(async (user) => {
      await Notification.create({
        user: user._id,
        message,
        type: 'system',
      });
    }),
  );

  // Respond with success message
  res.status(201).json({
    status: 'success',
    message: 'Notifications sent successfully',
  });
});
