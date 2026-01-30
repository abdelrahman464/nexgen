const axios = require('axios');
const ApiError = require('../../utils/apiError');
const Course = require('../../models/courseModel');
const Package = require('../../models/packageModel');
const CoursePackage = require('../../models/coursePackageModel');
const Order = require('../../models/orderModel');
const { checkCourseAccess } = require('../../utils/validators/courseValidator');
const { validateCoupon, canCouponApplyToScope } = require('../couponService');
const {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
} = require('./OrderService');

// Apple IAP Receipt Verification URLs
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

/**
 * Verify Apple IAP receipt with Apple servers
 * Automatically handles sandbox fallback
 */
const verifyAppleReceipt = async (receiptData, password = null) => {
  try {
    const requestBody = {
      'receipt-data': receiptData,
      'exclude-old-transactions': true,
    };

    // Add shared secret for auto-renewable subscriptions if provided
    if (password) {
      requestBody.password = password;
    }

    // Try production first
    let response = await axios.post(APPLE_PRODUCTION_URL, requestBody);

    // If status is 21007, receipt is from sandbox - retry with sandbox URL
    if (response.data.status === 21007) {
      console.log('Receipt is from sandbox environment, retrying...');
      response = await axios.post(APPLE_SANDBOX_URL, requestBody);
    }

    return response.data;
  } catch (error) {
    console.error('Apple receipt verification error:', error.message);
    throw new Error('Failed to verify receipt with Apple');
  }
};

/**
 * Validate Apple receipt response status codes
 */
const validateReceiptStatus = (status) => {
  const statusMessages = {
    0: 'Valid receipt',
    21000: 'The App Store could not read the JSON object you provided.',
    21002: 'The data in the receipt-data property was malformed or missing.',
    21003: 'The receipt could not be authenticated.',
    21004:
      'The shared secret you provided does not match the shared secret on file for your account.',
    21005: 'The receipt server is not currently available.',
    21006: 'This receipt is valid but the subscription has expired.',
    21007: 'This receipt is from the test environment.',
    21008: 'This receipt is from the production environment.',
    21010:
      'This receipt could not be authorized. Treat this the same as if a purchase was never made.',
  };

  return {
    isValid: status === 0,
    message: statusMessages[status] || 'Unknown status code',
    status,
  };
};

/**
 * Extract purchase information from verified receipt
 */
const extractPurchaseInfo = (verifiedReceipt) => {
  const { receipt, latest_receipt_info } = verifiedReceipt;

  // For consumables and non-consumables
  const inAppPurchases = receipt.in_app || [];

  // For subscriptions
  const latestPurchases = latest_receipt_info || [];

  // Get the most recent transaction
  const allTransactions = [...inAppPurchases, ...latestPurchases];

  if (allTransactions.length === 0) {
    throw new Error('No transactions found in receipt');
  }

  // Sort by purchase_date_ms to get the latest
  allTransactions.sort(
    (a, b) => parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms),
  );

  const latestTransaction = allTransactions[0];

  return {
    transactionId: latestTransaction.transaction_id,
    originalTransactionId: latestTransaction.original_transaction_id,
    productId: latestTransaction.product_id,
    purchaseDate: new Date(parseInt(latestTransaction.purchase_date_ms)),
    quantity: parseInt(latestTransaction.quantity || 1),
    expiresDate: latestTransaction.expires_date_ms
      ? new Date(parseInt(latestTransaction.expires_date_ms))
      : null,
    isTrialPeriod: latestTransaction.is_trial_period === 'true',
    bundleId: receipt.bundle_id,
    applicationVersion: receipt.application_version,
  };
};

/**
 * Course purchase via Apple IAP
 */
exports.coursePurchaseApple = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { receiptData, productId } = req.body;
    const { user } = req;

    // Validate input
    if (!receiptData) {
      return next(new ApiError('Receipt data is required', 400));
    }

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
      return next(new ApiError("There's no course", 404));
    }

    // Check if user can buy this course
    await checkCourseAccess(user, courseId);

    // Check if user already owns the course
    const existOrder = await Order.findOne({
      user: user._id,
      course: course._id,
    });
    if (existOrder) {
      return next(new ApiError('You already bought this course', 400));
    }

    // Verify receipt with Apple
    const verifiedReceipt = await verifyAppleReceipt(
      receiptData,
      process.env.APPLE_SHARED_SECRET,
    );

    // Validate receipt status
    const validation = validateReceiptStatus(verifiedReceipt.status);
    if (!validation.isValid) {
      return next(new ApiError(`Invalid receipt: ${validation.message}`, 400));
    }

    // Extract purchase info
    const purchaseInfo = extractPurchaseInfo(verifiedReceipt);

    // Verify product ID matches
    if (productId && purchaseInfo.productId !== productId) {
      return next(new ApiError('Product ID mismatch', 400));
    }

    // Calculate price (with coupon if applicable)
    let totalOrderPrice = course.priceAfterDiscount || course.price;
    let appliedCoupon = null;

    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      const scopeValidation = canCouponApplyToScope(coupon, 'course', courseId);
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
      appliedCoupon = req.body.couponName;
    }

    // Create order
    const paymentDetails = {
      id: courseId,
      email: user.email,
      price: totalOrderPrice,
      method: 'apple',
      couponName: appliedCoupon,
      transactionId: purchaseInfo.transactionId,
      originalTransactionId: purchaseInfo.originalTransactionId,
      productId: purchaseInfo.productId,
    };

    await createCourseOrderHandler(paymentDetails);

    res.status(200).json({
      status: 'success',
      message: 'Course purchased successfully',
      data: {
        transactionId: purchaseInfo.transactionId,
        productId: purchaseInfo.productId,
      },
    });
  } catch (err) {
    console.error('Apple IAP Course Purchase Error:', err);
    next(new ApiError(`Purchase failed: ${err.message}`, 500));
  }
};

/**
 * Package purchase via Apple IAP
 */
exports.packagePurchaseApple = async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const { receiptData, productId } = req.body;
    const { user } = req;

    if (!receiptData) {
      return next(new ApiError('Receipt data is required', 400));
    }

    const package = await Package.findById(packageId);
    if (!package) {
      return next(new ApiError("There's no Package", 404));
    }

    // Verify receipt
    const verifiedReceipt = await verifyAppleReceipt(
      receiptData,
      process.env.APPLE_SHARED_SECRET,
    );

    const validation = validateReceiptStatus(verifiedReceipt.status);
    if (!validation.isValid) {
      return next(new ApiError(`Invalid receipt: ${validation.message}`, 400));
    }

    const purchaseInfo = extractPurchaseInfo(verifiedReceipt);

    if (productId && purchaseInfo.productId !== productId) {
      return next(new ApiError('Product ID mismatch', 400));
    }

    // Calculate price
    let totalOrderPrice = package.priceAfterDiscount || package.price;
    let appliedCoupon = null;

    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      const scopeValidation = canCouponApplyToScope(
        coupon,
        'package',
        packageId,
      );
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
      appliedCoupon = req.body.couponName;
    }

    const paymentDetails = {
      id: packageId,
      email: user.email,
      price: totalOrderPrice,
      method: 'apple',
      couponName: appliedCoupon,
      transactionId: purchaseInfo.transactionId,
      originalTransactionId: purchaseInfo.originalTransactionId,
      productId: purchaseInfo.productId,
    };

    await createPackageOrderHandler(paymentDetails);

    res.status(200).json({
      status: 'success',
      message: 'Package purchased successfully',
      data: {
        transactionId: purchaseInfo.transactionId,
        productId: purchaseInfo.productId,
      },
    });
  } catch (err) {
    console.error('Apple IAP Package Purchase Error:', err);
    next(new ApiError(`Purchase failed: ${err.message}`, 500));
  }
};

/**
 * Course Package purchase via Apple IAP
 */
exports.coursePackagePurchaseApple = async (req, res, next) => {
  try {
    const { coursePackageId } = req.params;
    const { receiptData, productId } = req.body;
    const { user } = req;

    if (!receiptData) {
      return next(new ApiError('Receipt data is required', 400));
    }

    const coursePackage = await CoursePackage.findById(coursePackageId);
    if (!coursePackage) {
      return next(new ApiError("There's no course Package", 404));
    }

    // Verify receipt
    const verifiedReceipt = await verifyAppleReceipt(
      receiptData,
      process.env.APPLE_SHARED_SECRET,
    );

    const validation = validateReceiptStatus(verifiedReceipt.status);
    if (!validation.isValid) {
      return next(new ApiError(`Invalid receipt: ${validation.message}`, 400));
    }

    const purchaseInfo = extractPurchaseInfo(verifiedReceipt);

    if (productId && purchaseInfo.productId !== productId) {
      return next(new ApiError('Product ID mismatch', 400));
    }

    // Calculate price
    let totalOrderPrice =
      coursePackage.priceAfterDiscount || coursePackage.price;
    let appliedCoupon = null;

    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      const scopeValidation = canCouponApplyToScope(
        coupon,
        'coursePackage',
        coursePackageId,
      );
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
      appliedCoupon = req.body.couponName;
    }

    const paymentDetails = {
      id: coursePackageId,
      email: user.email,
      price: totalOrderPrice,
      method: 'apple',
      couponName: appliedCoupon,
      transactionId: purchaseInfo.transactionId,
      originalTransactionId: purchaseInfo.originalTransactionId,
      productId: purchaseInfo.productId,
    };

    await createCoursePackageOrderHandler(paymentDetails);

    res.status(200).json({
      status: 'success',
      message: 'Course Package purchased successfully',
      data: {
        transactionId: purchaseInfo.transactionId,
        productId: purchaseInfo.productId,
      },
    });
  } catch (err) {
    console.error('Apple IAP Course Package Purchase Error:', err);
    next(new ApiError(`Purchase failed: ${err.message}`, 500));
  }
};

/**
 * Apple Server-to-Server Notification Webhook
 * Handles subscription renewals, cancellations, refunds, etc.
 */
exports.appleWebhook = async (req, res, next) => {
  try {
    const notification = req.body;

    console.log(
      'Apple Notification Received:',
      JSON.stringify(notification, null, 2),
    );

    // Validate notification structure
    if (!notification || !notification.notification_type) {
      console.error('Invalid notification structure');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification structure',
      });
    }

    const { notification_type, unified_receipt, password } = notification;

    // Handle different notification types
    switch (notification_type) {
      case 'INITIAL_BUY':
        console.log('Initial purchase notification received');
        // Usually already handled by the purchase endpoint
        break;

      case 'DID_RENEW':
        console.log('Subscription renewed');
        // Handle subscription renewal
        // You might want to extend the user's access here
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        console.log('Renewal status changed');
        // Handle when user turns auto-renewal on/off
        break;

      case 'DID_FAIL_TO_RENEW':
        console.log('Subscription failed to renew');
        // Handle failed renewal - maybe notify user
        break;

      case 'CANCEL':
        console.log('Subscription cancelled');
        // Handle cancellation - revoke access
        break;

      case 'REFUND':
        console.log('Purchase refunded');
        // Handle refund - revoke access and update order
        if (unified_receipt) {
          // You can verify the receipt and find the order to mark as refunded
          // This requires storing original_transaction_id in your Order model
        }
        break;

      case 'DID_CHANGE_RENEWAL_PREF':
        console.log('User changed renewal preference');
        break;

      case 'REVOKE':
        console.log('Purchase revoked by Apple');
        // Revoke access immediately
        break;

      default:
        console.log(`Unhandled notification type: ${notification_type}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Apple Webhook Error:', err);
    // Return 200 to prevent Apple from retrying
    res.status(200).json({
      status: 'error',
      message: 'Error processing notification',
      error: err.message,
    });
  }
};

/**
 * Verify ownership of a purchase (useful for restoring purchases)
 */
exports.verifyPurchase = async (req, res, next) => {
  try {
    const { receiptData, productId } = req.body;
    const { user } = req;

    if (!receiptData) {
      return next(new ApiError('Receipt data is required', 400));
    }

    // Verify receipt
    const verifiedReceipt = await verifyAppleReceipt(
      receiptData,
      process.env.APPLE_SHARED_SECRET,
    );

    const validation = validateReceiptStatus(verifiedReceipt.status);
    if (!validation.isValid) {
      return next(new ApiError(`Invalid receipt: ${validation.message}`, 400));
    }

    const purchaseInfo = extractPurchaseInfo(verifiedReceipt);

    // Find existing order
    const order = await Order.findOne({
      user: user._id,
      paymentMethod: 'apple',
      $or: [
        { appleTransactionId: purchaseInfo.transactionId },
        { appleTransactionId: purchaseInfo.originalTransactionId },
      ],
    });

    if (order) {
      return res.status(200).json({
        status: 'success',
        message: 'Purchase verified',
        data: {
          hasAccess: true,
          productId: purchaseInfo.productId,
          transactionId: purchaseInfo.transactionId,
        },
      });
    }

    res.status(404).json({
      status: 'success',
      message: 'No purchase found',
      data: {
        hasAccess: false,
      },
    });
  } catch (err) {
    console.error('Verify Purchase Error:', err);
    next(new ApiError(`Verification failed: ${err.message}`, 500));
  }
};

// Export helper functions for testing or reuse
exports.verifyAppleReceipt = verifyAppleReceipt;
exports.validateReceiptStatus = validateReceiptStatus;
exports.extractPurchaseInfo = extractPurchaseInfo;
