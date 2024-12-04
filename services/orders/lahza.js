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
const { calculateProfits } = require("../marketing/marketingService");
const { availUserToReview } = require("../userService");
const {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
} = require("./OrderService");

const createLahzaTransaction = async (email, first_name, amount, metadata) => {
  const data = {
    email,
    first_name,
    amount,
    metadata,
    currency: "USD",
  };

  const jsonData = JSON.stringify(data);

  try {
    const response = await axios.post(
      "https://api.lahza.io/transaction/initialize",
      jsonData,
      {
        headers: {
          authorization: `Bearer ${process.env.LAHZA_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Lahza response:", response.data);
    return response.data.data.authorization_url;
  } catch (error) {
    console.error(
      "Error creating transaction:",
      error.response?.data || error.message
    );
    throw new Error("Failed to create transaction");
  }
};
//Once the user completes the payment, Lahza will redirect them to your callback URL with a reference parameter. Verify this transaction with Lahza’s API.
const verifyLahzaTransaction = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.lahza.io/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LAHZA_SECRET_KEY}`,
        },
      }
    );

    return response.data.data.status === "success";
  } catch (error) {
    console.error(
      "Error verifying transaction:",
      error.response?.data || error.message
    );
    throw new Error("Failed to verify transaction");
  }
};
//handler for verification
exports.LahzaPaymentCallback = async (req, res, next) => {
  const reference = req.query.reference;

  try {
    const isVerified = await verifyLahzaTransaction(reference);
    if (isVerified) {
      // Proceed with order fulfillment
      res.redirect(`https://nexgen-academy.com/${req.locale}`);
    } else {
      res.redirect(`https://nexgen-academy.com/${req.locale}/error-page`);
    }
  } catch (error) {
    res.status(500).json({ error: "Verification process failed" });
  }
};

exports.courseCheckoutSessionLahza = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { user } = req;
  const course = await Course.findById(courseId);

  if (!course) {
    return next(new ApiError("There's no course", 404));
  }

  const existOrder = await Order.findOne({
    user: user._id,
    course: course._id,
  });
  if (existOrder) {
    return next(new ApiError("You already bought this course", 400));
  }

  const coursePrice = course.priceAfterDiscount || course.price;
  const totalOrderPrice = Math.ceil(coursePrice * 100);

  // Check if user can buy this course or not
  await checkCourseAccess(user, courseId);

  const metadata = {
    id: courseId,
    email: user.email,
    type: "course",
  };

  try {
    const order = await createLahzaTransaction(
      user.email,
      user.name,
      totalOrderPrice.toString(),
      metadata
    );

    res.status(200).json({
      status: "success",
      redirectUrl: order,
    });
  } catch (err) {
    return next(
      new ApiError(`Lahza order creation failed: ${err.message}`, 500)
    );
  }
});

// Course Package Checkout Session using lahza
exports.coursePackageCheckoutSessionLahza = asyncHandler(
  async (req, res, next) => {
    const { coursePackageId } = req.params;
    const { user } = req;
    const coursePackage = await CoursePackage.findById(coursePackageId);
    if (!coursePackage) {
      return next(new ApiError("There's no course Package", 404));
    }

    const coursePackagePrice =
      coursePackage.priceAfterDiscount || coursePackage.price;
    const totalOrderPrice = Math.ceil(coursePackagePrice * 100);

    const metadata = {
      id: coursePackageId,
      email: user.email,
      type: "coursePackage",
    };

    try {
      const order = await createLahzaTransaction(
        user.email,
        user.name,
        totalOrderPrice.toString(),
        metadata
      );

      res.status(200).json({
        status: "success",
        redirectUrl: order,
      });
    } catch (err) {
      return next(
        new ApiError(`Lahza order creation failed: ${err.message}`, 500)
      );
    }
  }
);

// // Package Checkout Session using lahza
exports.packageCheckoutSessionLahza = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { user } = req;
  const package = await Package.findById(packageId);
  if (!package) {
    return next(new ApiError("There's no Package", 404));
  }

  const packagePrice = package.priceAfterDiscount || package.price;
  const totalOrderPrice = Math.ceil(packagePrice * 100);

  const metadata = {
    id: packageId,
    email: user.email,
    type: "package",
  };

  try {
    const order = await createLahzaTransaction(
      user.email,
      user.name,
      totalOrderPrice.toString(),
      metadata
    );

    res.status(200).json({
      status: "success",
      redirectUrl: order,
    });
  } catch (err) {
    return next(
      new ApiError(`Lahza order creation failed: ${err.message}`, 500)
    );
  }
});
// // Webhook handler for Cryptomus payment notifications

exports.lahzaWebhook = async (req, res, next) => {
  const event = req.body;

  // Confirm the event type
  if (event.event === "charge.success") {
    // Access transaction details, including metadata
    const transactionReference = event.data.reference;
    const metadata = event.data.metadata;
    const price = event.data.amount / 100;

    // Now you can access specific metadata fields
    const id = metadata.id;
    const type = metadata.type;
    const email = metadata.email;

    switch (type) {
      case "course":
        await createCourseOrderHandler(id, email, price, "lahza");
        break;
      case "package":
        await createPackageOrderHandler(id, email, price, "lahza");
        break;
      case "coursePackage":
        await createCoursePackageOrderHandler(id, email, price, "lahza");
        break;
      default:
        console.error(`Unknown type: ${type}`);
        return res.redirect(
          "https://nexgen-academy.com/${req.locale}/error-page"
        );
    }

    // Acknowledge receipt of the webhook
    res.sendStatus(200);
  } else if (event.event === "charge.failed") {
    console.log("Payment failed:", event.data.reference);
    res.sendStatus(200);
  } else {
    // Handle other event types if necessary
    res.sendStatus(400); // Bad request for unsupported events
  }
};
