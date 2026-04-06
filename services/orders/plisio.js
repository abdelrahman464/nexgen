const crypto = require("crypto");
const axios = require("axios");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const Order = require("../../models/orderModel");
const Course = require("../../models/courseModel");
const Package = require("../../models/packageModel");
const CoursePackage = require("../../models/coursePackageModel");
const UserSubscription = require("../../models/userSubscriptionModel");
const User = require("../../models/userModel");
const Chat = require("../../models/ChatModel");
const Notification = require("../../models/notificationModel");
const CourseProgress = require("../../models/courseProgressModel");
const { checkCourseAccess } = require("../../utils/validators/courseValidator");
const { availUserToReview } = require("../userService");
const {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
} = require("./OrderService");

const { validateCoupon } = require("../couponService");

const createPlisioTransaction = async (options) => {
  try {
    const params = {
      api_key: process.env.PLISIO_SECRET_KEY,
      currency: "USDT_TRX",
      order_name: options.type || "course",
      order_number: options.orderId,
      amount: options.amount,
      email: options.userEmail,
      description: options.id,
      callback_url: `${process.env.PLISIO_CALLBACK_URL}?json=true`,
    };

    const response = await axios.get(
      "https://api.plisio.net/api/v1/invoices/new",
      { params },
    );

    // Check if response is successful
    if (response.data.status !== "success") {
      throw new Error("Unsuccessful response from Plisio API");
    }

    // Get the invoice URL from the response
    const invoiceUrl = response.data.data.invoice_url;
    if (!invoiceUrl) {
      throw new Error("No invoice URL in response");
    }

    // console.log('Plisio transaction created:', {
    //   orderId: options.orderId,
    //   email: options.email,
    //   amount: options.amount,
    //   invoiceUrl: invoiceUrl,
    // });

    return invoiceUrl;
  } catch (error) {
    console.error(
      "Error creating Plisio transaction:",
      error.response?.data || error.message,
    );
    throw new Error(
      "Failed to create Plisio transaction: " +
        (error.response?.data?.message || error.message),
    );
  }
};

// Course Checkout Session using Plisio
exports.courseCheckoutSessionPlisio = asyncHandler(async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { user } = req;
    const course = await Course.findById(courseId);

    if (!course) {
      return next(new ApiError("There's no course", 404));
    }
    // Check if user can buy this course or not
    await checkCourseAccess(user, courseId);

    const existOrder = await Order.findOne({
      user: user._id,
      course: course._id,
    });
    if (existOrder) {
      return next(new ApiError("You already bought this course", 400));
    }

    const coursePrice = course.priceAfterDiscount || course.price;
    let totalOrderPrice = coursePrice.toFixed(2);

    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === "string") {
        return next(new ApiError(res.__(coupon), 400));
      }
      // Check if coupon can be applied to this course
      const scopeValidation = canCouponApplyToScope(coupon, "course", courseId);
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }

    const options = {
      id: `${courseId}|${user.email}|${req.body.couponName || null}`,
      userEmail: user.email,
      amount: totalOrderPrice,
      type: "course",
      orderId: `COURSE_${courseId}_${Date.now()}`,
      userId: user._id,
    };

    try {
      const redirectUrl = await createPlisioTransaction(options);

      res.status(200).json({
        status: "success",
        redirectUrl: redirectUrl,
      });
    } catch (err) {
      return next(
        new ApiError(
          `Plisio order creation failed: ${err.message}`,
          err.statusCode,
        ),
      );
    }
  } catch (err) {
    return next(
      new ApiError(
        `Plisio order creation failed: ${err.message}`,
        err.statusCode,
      ),
    );
  }
});

// Course Package Checkout Session using Plisio
exports.coursePackageCheckoutSessionPlisio = asyncHandler(
  async (req, res, next) => {
    const { coursePackageId } = req.params;
    const { user } = req;
    const coursePackage = await CoursePackage.findById(coursePackageId);

    if (!coursePackage) {
      return next(new ApiError("There's no course Package", 404));
    }

    const coursePackagePrice =
      coursePackage.priceAfterDiscount || coursePackage.price;
    let totalOrderPrice = coursePackagePrice.toFixed(2);

    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === "string") {
        return next(new ApiError(res.__(coupon), 400));
      }
      // Check if coupon can be applied to this course package
      const scopeValidation = canCouponApplyToScope(
        coupon,
        "coursePackage",
        coursePackageId,
      );
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }

    const options = {
      id: `${coursePackageId}|${user.email}|${req.body.couponName || null}`,
      userEmail: user.email,
      amount: totalOrderPrice,
      type: "coursePackage",
      orderId: `PACKAGE_${coursePackageId}_${Date.now()}`,
      userId: user._id,
    };

    try {
      const redirectUrl = await createPlisioTransaction(options);

      res.status(200).json({
        status: "success",
        redirectUrl: redirectUrl,
      });
    } catch (err) {
      return next(
        new ApiError(`Plisio order creation failed: ${err.message}`, 500),
      );
    }
  },
);

// Package Checkout Session using Plisio
exports.packageCheckoutSessionPlisio = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { user } = req;
  const package = await Package.findById(packageId);

  if (!package) {
    return next(new ApiError("There's no Package", 404));
  }

  const packagePrice = package.priceAfterDiscount || package.price;
  const totalOrderPrice = packagePrice.toFixed(2);

  if (req.body.couponName) {
    const coupon = await validateCoupon(req.body.couponName, user.invitor);

    if (typeof coupon === "string") {
      return next(new ApiError(res.__(coupon), 400));
    }
    // Check if coupon can be applied to this package
    const scopeValidation = canCouponApplyToScope(coupon, "package", packageId);
    if (!scopeValidation.canApply) {
      return next(new ApiError(scopeValidation.errorMessage, 400));
    }

    totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
  }

  const options = {
    id: `${packageId}|${user.email}|${req.body.couponName || null}`,
    userEmail: user.email,
    amount: totalOrderPrice,
    type: "package",
    orderId: `PKG_${packageId}_${Date.now()}`,
    userId: user._id,
  };

  try {
    const redirectUrl = await createPlisioTransaction(options);

    res.status(200).json({
      status: "success",
      redirectUrl: redirectUrl,
    });
  } catch (err) {
    return next(
      new ApiError(`Plisio order creation failed: ${err.message}`, 500),
    );
  }
});

// Utility function to verify Plisio signatures
const verifyPlisioSignature = (data) => {
  try {
    if (!data || typeof data !== "object") {
      console.error("Invalid data received for verification");
      return false;
    }

    // Get verify_hash and remove it from data for verification
    const verify_hash = data.verify_hash;
    if (!verify_hash) {
      console.error("No verify_hash found in data");
      return false;
    }

    const ordered = { ...data };
    delete ordered.verify_hash;

    // Create string from ordered data
    const string = JSON.stringify(ordered);

    // Create HMAC using SHA1
    const hmac = crypto.createHmac("sha1", process.env.PLISIO_SECRET_KEY);
    const hash = hmac.update(string).digest("hex");

    const isValid = hash === verify_hash;
    if (!isValid) {
      console.error("Signature verification failed");
    }
    return isValid;
  } catch (error) {
    console.error("Error verifying Plisio signature:", error);
    return false;
  }
};
// Plisio Payment Callback (Webhook Handler)
// Plisio Payment Callback (Webhook Handler)
exports.plisioWebhook = asyncHandler(async (req, res) => {
  // console.log(
  //   'Received Plisio webhook payload:',
  //   JSON.stringify(req.body, null, 2),
  // );

  if (!req.body) {
    console.error("No payload received in webhook");
    return res.status(400).json({ error: "No payload received" });
  }

  try {
    // Verify webhook signature
    if (!verifyPlisioSignature(req.body)) {
      console.error("Invalid Plisio webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const {
      status,
      order_description,
      order_name: itemType,
      amount,
      currency,
      order_number: orderNumber,
      txn_id: transactionId,
    } = req.body;
    //order_description = itemId|userEmail
    const [itemId, userEmail, couponName] = order_description.split("|");

    // Validate required fields
    if (!itemId || !itemType || !amount) {
      console.error("Missing required fields in webhook data", {
        itemId,
        itemType,
        amount,
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const paymentDetails = {
      id: itemId,
      email: userEmail,
      price: amount,
      method: "plisio",
      couponName,
    };

    // Handle different payment statuses
    switch (status) {
      case "completed":
        try {
          // Extract userId from order number (assuming format: COURSE_courseId_timestamp)
          const price = parseFloat(amount);

          // Process based on order type
          switch (itemType.toLowerCase()) {
            case "course":
              await createCourseOrderHandler(paymentDetails);
              break;

            case "package":
              await createPackageOrderHandler(paymentDetails);
              break;

            case "coursepackage":
              await createCoursePackageOrderHandler(paymentDetails);
              break;

            default:
              console.error(`Unknown order type: ${itemType}`);
              return res.status(400).json({ error: "Invalid order type" });
          }

          console.log(
            `Successfully processed ${itemType} order for transaction ${transactionId}`,
          );
        } catch (error) {
          console.error(`Error processing ${itemType} order:`, error);
          // Still return 200 to acknowledge receipt
          return res.status(200).json({
            status: "error",
            message: "Order processed with errors",
          });
        }
        break;

      case "pending":
        console.log("Payment pending:", {
          orderNumber,
          transactionId,
        });
        break;

      case "failed":
        console.log("Payment failed:", {
          orderNumber,
          transactionId,
        });
        break;

      case "expired":
        console.log("Payment expired:", {
          orderNumber,
          transactionId,
        });
        break;

      default:
        console.log(`Unhandled payment status: ${status}`, {
          orderNumber,
          transactionId,
        });
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({
      status: "success",
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Plisio webhook processing error:", error);
    // Still return 200 to prevent retries, but log the error
    return res.status(200).json({
      status: "error",
      message: "Webhook processed with errors",
    });
  }
});
// Payment callback handler (for redirects)
exports.plisioPaymentCallback = async (req, res) => {
  const { status, order_number } = req.query;

  try {
    if (status === "success") {
      res.redirect(`${process.env.FRONTEND_URL}/payment-success`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
    }
  } catch (error) {
    console.error("Payment callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
  }
};
