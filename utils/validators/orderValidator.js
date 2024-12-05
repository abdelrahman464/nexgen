const { check, query } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel');

exports.purchaseForUserValidator = [
  check('id')
    .notEmpty()
    .withMessage('item id is required')
    .isMongoId()
    .withMessage('invalid item id '),
  check('type')
    .notEmpty()
    .withMessage('type is required')
    .isIn(['course', 'package', 'coursePackage'])
    .withMessage(
      'invalid type , type should be course or package or coursePackage',
    ),
  check('userId')
    .notEmpty()
    .withMessage('userId is required')
    .isMongoId()
    .withMessage('invalid userId '),
  check('isPaid')
    .notEmpty()
    .withMessage('isPaid key is required ')
    .isIn([true, false])
    .withMessage('isPaid key should be either true or false'),

  validatorMiddleware,
];

exports.queryParamsValidator = [
  query('userId').optional().isMongoId().withMessage('invalid userId '),
  query('startDate').optional(),
  query('endDate').optional(),
  validatorMiddleware,
];
/*desc: check if the sender of request is authorized to view the orders of specific user
------- this middleware is used in only when sender is trying to view the orders of specific user
    logic:
        if sender is admin ? pass him 
        else ? check if the sender is the invitor of the user ? pass him
        else ? throw error

*/

exports.isAuthToView = async (req, res, next) => {
  try {
    if (req.query.userId) {
      if (req.user.role !== 'admin') {
        const isUserExist = await User.exists({
          _id: req.query.userId,
          invitor: req.user._id,
        });
        //check if the sender of request is the invitor of the user
        if (isUserExist) {
          return next();
        }
        throw new Error("You are not authorized to view this user's orders");
      }
    }
    //if sender of request is admin
    return next();
  } catch (err) {
    return res.status(403).json({ status: `failed`, error: err.message });
  }
};

// * Prevent users from placing an order if they have created one within the past hour.
exports.checkExistingPaidOrder = async (req, res, next) => {
  try {
    // Get the user's orders created within the past hour and already paid
    const orders = await Order.find({
      user: req.user._id,
      isPaid: true,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });

    // If there are any paid orders in the past hour, calculate the remaining time
    if (orders.length > 0) {
      const lastOrderTime = orders[0].createdAt.getTime();
      const nextAllowedTime = new Date(lastOrderTime + 60 * 60 * 1000); // 1 hour after the last order
      const remainingTime = Math.max(0, nextAllowedTime.getTime() - Date.now());

      // Format remaining time into minutes and seconds
      const minutes = Math.floor(remainingTime / 60000);
      const seconds = Math.floor((remainingTime % 60000) / 1000);

      return res.status(403).json({
        status: 'failed',
        error: `You have already placed an order within the past hour. Please wait ${minutes} minutes and ${seconds} seconds to place another order.`,
      });
    }

    return next(); // Allow the request if no recent paid orders are found
  } catch (err) {
    return res.status(500).json({ status: 'failed', error: err.message });
  }
};
