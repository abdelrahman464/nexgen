const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const Order = require('../models/orderModel');
const Course = require('../models/courseModel');
const Package = require('../models/packageModel');
const CoursePackage = require('../models/coursePackageModel');
const UserSubscription = require('../models/userSubscriptionModel');
const User = require('../models/userModel');
const Chat = require('../models/ChatModel');
const Notification = require('../models/notificationModel');
const CourseProgress = require('../models/courseProgressModel');
const { checkCourseAccess } = require('../utils/validators/courseValidator');
const { calculateProfits } = require('./marketingService');
const { availUserToReview } = require('./userService');

exports.filterOrders = asyncHandler(async (req, res, next) => {
  const filterObject = {};
  const newQuery = { ...req.query };

  //1- if marketer or admin is trying to get specific user orders
  if (req.query.userId) {
    filterObject.user = req.query.userId;
    delete newQuery.userId;
  }
  //2- if the user is trying to get their own orders
  else if (req.user.role === 'user') {
    filterObject.user = req.user._id;
  }

  // Date filtering logic
  if (req.query.startDate && req.query.endDate) {
    filterObject.paidAt = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
    // Removing the keys from the query
    delete newQuery.startDate;
    delete newQuery.endDate;
  } else if (req.query.day) {
    const dayStart = new Date(req.query.day);
    const dayEnd = new Date(req.query.day);
    dayEnd.setUTCHours(23, 59, 59, 999); // Set to the end of the day

    filterObject.paidAt = {
      $gte: dayStart,
      $lte: dayEnd,
    };
    // Removing the key from the query
    delete newQuery.day;
  }

  req.filterObj = filterObject;
  // Reset query params
  req.query = newQuery;
  next();
});

exports.findAllOrders = factory.getALl(Order);
//@desc get specific orders
//@route GET /api/v1/orders/:orderId
//@access protected/
exports.findSpecificOrder = factory.getOne(Order);

//function environment() {
//  const clientId = process.env.PAYPAL_CLIENT_ID;
//  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
//  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
//}
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  return new paypal.core.LiveEnvironment(clientId, clientSecret);
}

function paypalClient() {
  return new paypal.core.PayPalHttpClient(environment());
}

exports.courseCheckoutSession = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { user } = req;
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ApiError("There's no course", 404));
  }

  //check if user already bought the course
  const existOrder = await Order.findOne({
    user: user._id,
    course: course._id,
  });
  if (existOrder) {
    return next(new ApiError('You already bought this course', 400));
  }

  const coursePrice = course.priceAfterDiscount
    ? course.priceAfterDiscount
    : course.price;
  const totalOrderPrice = Math.ceil(coursePrice);

  // check if user can buy this course or Not
  await checkCourseAccess(user, courseId);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `${courseId.toString()}|${user.email}|course`, // This can serve a similar purpose as custom_id
        custom_id: courseId.toString(), // Here is where you place the custom_id
        amount: {
          currency_code: 'USD',
          value: totalOrderPrice.toString(),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: totalOrderPrice.toString(),
            },
          },
        },
        description: course.title,
        items: [
          {
            name: course.title,
            unit_amount: {
              currency_code: 'USD',
              value: totalOrderPrice.toString(),
            },
            quantity: '1',
          },
        ],
      },
    ],
    application_context: {
      return_url: `https://api.nexgen-academy.com/api/v1/orders/capture-payment`, // Success URL
      cancel_url: `http://your-domain.com/checkout-cancel`, // Cancel URL
      user_action: 'PAY_NOW', // This encourages payers to pay immediately with their card
      landing_page: 'BILLING', // Directs users to the billing page, not the login page
      shipping_preference: 'NO_SHIPPING', // Set to 'GET_FROM_FILE' if you require shipping
    },
  });

  try {
    const order = await paypalClient().execute(request);
    res.status(200).json({
      status: 'success',
      orderId: order.result.id,
      redirectUrl: order.result.links.find((link) => link.rel === 'approve')
        .href,
    });
  } catch (err) {
    return next(
      new ApiError(`PayPal order creation failed: ${err.message}`, 500),
    );
  }
});

exports.coursePackageCheckoutSession = asyncHandler(async (req, res, next) => {
  const { coursePackageId } = req.params;
  const { user } = req;
  const coursePackage = await CoursePackage.findById(coursePackageId);
  if (!coursePackage) {
    return next(new ApiError("There's no course Package", 404));
  }

  const coursePackagePrice = coursePackage.priceAfterDiscount
    ? coursePackage.priceAfterDiscount
    : coursePackage.price;
  const totalOrderPrice = Math.ceil(coursePackagePrice);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `${coursePackageId.toString()}|${
          user.email
        }|coursePackage`,
        amount: {
          currency_code: 'USD',
          value: totalOrderPrice.toString(),
        },
        description: `Purchase of Course Package: ${coursePackage.title}`,
        custom_id: coursePackageId.toString(), // Used to identify the order later
      },
    ],
    application_context: {
      return_url: `https://api.nexgen-academy.com/api/v1/orders/capture-payment`,
      cancel_url: `http://nexgen-academy.com/cancel`,
      user_action: 'PAY_NOW', // This encourages payers to pay immediately with their card
      landing_page: 'BILLING', // Directs users to the billing page, not the login page
      shipping_preference: 'NO_SHIPPING', // Set to 'GET_FROM_FILE' if you require shipping
    },
  });

  try {
    const order = await paypalClient().execute(request);
    res.status(200).json({
      status: 'success',
      orderId: order.result.id,
      redirectUrl: order.result.links.find((link) => link.rel === 'approve')
        .href,
    });
  } catch (err) {
    return next(
      new ApiError(`PayPal order creation failed: ${err.message}`, 500),
    );
  }
});

exports.createCoursePackageOrder = asyncHandler(async (req, res, next) => {
  const { coursePackageId, price, email, method } = req.params;
  const coursePackage = await CoursePackage.findById(coursePackageId);
  if (!coursePackage) throw new Error('CoursePackage not found');

  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const order = await Order.create({
    user: user._id,
    coursePackage: coursePackage._id,
    totalOrderPrice: price,
    isPaid: true,
    paymentMethodType: method,
    paidAt: Date.now(),
    //paypalOrderId: paypalOrderId  // Adding the PayPal order ID to the order document
  });

  if (!order) throw new Error("Couldn't create order");

  // Create progress for user for each course in the package and subscribe user to the package
  // and add user to group chat per course and send notification
  await Promise.all(
    coursePackage.courses.map(async (courseId) => {
      //check if user is havig the course first
      const existOrder = await CourseProgress.findOne({
        user: user._id,
        course: courseId,
      });
      if (!existOrder) {
        await CourseProgress.create({
          user: user._id,
          course: courseId,
          progress: [],
        });
      }

      // Add user to group chat per course and send notification
      const chat = await Chat.findOneAndUpdate(
        { course: courseId, isGroupChat: true },
        { $addToSet: { participants: { user: user._id, isAdmin: false } } },
        { new: true },
      );
      if (chat) {
        await Notification.create({
          user: user._id,
          message: `${user.name} has been added to the group ${chat.groupName}`,
          chat: chat._id,
          type: 'chat',
        });
      }

      // Subscribe user to package related to the course
      const package = await Package.findOne({ course: courseId });
      if (package) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        const subscriptionDurationDays = 4 * 30; // 4 months
        endDate.setDate(startDate.getDate() + subscriptionDurationDays);
        await UserSubscription.create({
          user: user._id,
          package: package._id,
          startDate,
          endDate,
        });
      }
    }),
  );

  //4-avail user to review
  await availUserToReview(user._id);

  const data = {
    email: user.email,
    amount: price,
    item: `Course Package: ${coursePackage.title}`,
  };
  //5) calculate profits
  await calculateProfits(data);
  return true;
});

exports.packageCheckoutSession = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { user } = req;
  const package = await Package.findById(packageId);
  if (!package) {
    return next(new ApiError("There's no Package", 404));
  }

  const packagePrice = package.priceAfterDiscount
    ? package.priceAfterDiscount
    : package.price;
  const totalOrderPrice = Math.ceil(packagePrice);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `${packageId.toString()}|${user.email}|package`,
        amount: {
          currency_code: 'USD',
          value: totalOrderPrice.toString(),
        },
        description: package.title,
        custom_id: packageId.toString(), // Used to create order
      },
    ],
    application_context: {
      return_url: `https://api.nexgen-academy.com/api/v1/orders/capture-payment`,
      cancel_url: `http://nexgen-academy.com/cancel`,
      user_action: 'PAY_NOW', // This encourages payers to pay immediately with their card
      landing_page: 'BILLING', // Directs users to the billing page, not the login page
      shipping_preference: 'NO_SHIPPING', // Set to 'GET_FROM_FILE' if you require shipping
    },
  });

  try {
    const order = await paypalClient().execute(request);
    res.status(200).json({
      status: 'success',
      orderId: order.result.id,
      redirectUrl: order.result.links.find((link) => link.rel === 'approve')
        .href,
    });
  } catch (err) {
    return next(
      new ApiError(`PayPal order creation failed: ${err.message}`, 500),
    );
  }
});

exports.createPackageOrder = asyncHandler(async (req, res, next) => {
  const { packageId, price, email, method } = req.params;
  const package = await Package.findById(packageId);
  if (!package) throw new Error('Package not found');

  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const order = await Order.create({
    user: user._id,
    package: package._id,
    totalOrderPrice: price,
    isPaid: true,
    paymentMethodType: method,
    paidAt: Date.now(),
    // paypalOrderId: paypalOrderId  // Adding the PayPal order ID to the order document
  });

  if (!order) throw new Error("Couldn't create order");

  // 3) Create user subscription if not exist, and if it exists renew his subscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + package.subscriptionDurationDays);

  const subscription = await UserSubscription.findOne({
    user: user._id,
    package: package._id,
  }).sort({ endDate: -1 });

  if (subscription) {
    // If a subscription exists, renew it by updating the endDate
    subscription.endDate = endDate;
    await subscription.save();
  }
  // Only create a new subscription if no existing subscription was found or renewed
  await UserSubscription.create({
    user: user._id,
    package: package._id,
    startDate,
    endDate,
  });
  //4-avail user to review
  await availUserToReview(user._id);
  //5) calculate profits
  const data = {
    email: user.email,
    amount: price,
    item: `package: ${package.title}`,
  };
  await calculateProfits(data);
  return true;
});

// Function to handle capturing a payment
exports.capturePayment = asyncHandler(async (req, res, next) => {
  const { token } = req.query;

  const request = new paypal.orders.OrdersCaptureRequest(token);
  request.requestBody({});

  try {
    // Capture the payment
    const capture = await paypalClient().execute(request);

    // You might want to check capture.result.status to confirm the payment status
    if (capture.result.status === 'COMPLETED') {
      const [referenceId, userEmail, type] =
        capture.result.purchase_units[0].reference_id.split('|');
      const price =
        capture.result.purchase_units[0].payments.captures[0].amount.value; // Total amount from the capture object

      if (type === 'course') {
        res.redirect(
          `https://api.nexgen-academy.com/api/v1/orders/courseOrder/${referenceId}/${price}/${userEmail}/paypal`,
        ); // Redirect the user to a success page
      } else if (type === 'package') {
        res.redirect(
          `https://api.nexgen-academy.com/api/v1/orders/packageOrder/${referenceId}/${price}/${userEmail}/paypal`,
        ); // Redirect the user to a success page
      } else if (type === 'coursePackage') {
        res.redirect(
          `https://api.nexgen-academy.com/api/v1/orders/coursePackageOrder/${referenceId}/${price}/${userEmail}/paypal`,
        ); // Redirect the user to a success page
      }
    } else {
      // Handle failures, such as logging and user notifications
      console.error('Payment capture failed', capture.result);
      res.redirect('/error-page'); // Redirect the user to an error page
    }
  } catch (err) {
    // Log and handle errors
    console.error('Payment capture error', err);
    return next(new ApiError(`Payment capture failed: ${err.message}`, 500));
  }
});

//   ============      Helpers     =================
// note : these helpers is used in create course function to apply single responsibility principle
async function createOrder(user, course, price, method) {
  //check if user is havig the course first
  const existOrder = await Order.findOne({
    user: user._id,
    course: course._id,
    paymentMethodType: method,
  });
  if (!existOrder) {
    await Order.create({
      user: user._id,
      course: course._id,
      totalOrderPrice: price,
      isPaid: true,
      paymentMethodType: method,
      paidAt: Date.now(),
    });
  }
}
//------------

async function createCourseProgress(user, course) {
  await CourseProgress.create({
    user: user._id,
    course: course._id,
    progress: [],
  });
}
//------------
async function addUserToGroupChat(user, course) {
  const chat = await Chat.findOneAndUpdate(
    { course: course._id, isGroupChat: true },
    //use addToSet to avoid duplicate users
    {
      $addToSet: { participants: { user: user._id, isAdmin: false } },
    },
    { new: true },
  );
  //send notification
  await Notification.create({
    user: user._id,
    message: {
      en: `you has been added to the group ${chat.groupName}`,
      ar: `تمت اضافتك الى المجموعة ${chat.groupName}`,
    },
    chat: chat._id,
    type: 'chat',
  });
}
async function kickUserFromGroupChat(user, course) {
  const chat = await Chat.findOneAndUpdate(
    { course: course._id, isGroupChat: true },
    { $pull: { participants: { user: user._id } } },
    { new: true },
  );
  //send notification
  await Notification.create({
    user: user._id,
    message: {
      en: `you has been kicked from the group ${chat.groupName}`,
      ar: `تمت طردك من المجموعة ${chat.groupName}`,
    },
    chat: chat._id,
    type: 'chat',
  });
}
//------------
async function subscribeUserToPackage(user, course) {
  const package = await Package.findOne({ course: course._id });
  if (package) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    const subscriptionDurationDays = 5 * 30; // 5 months
    endDate.setDate(startDate.getDate() + subscriptionDurationDays);
    return await UserSubscription.create({
      user: user._id,
      package: package._id,
      startDate,
      endDate,
    });
  }
}
//  ===============================================
exports.createCourseOrder = asyncHandler(async (req, res, next) => {
  const { courseId, price, email, method } = req.params;

  try {
    const [course, user] = await Promise.all([
      Course.findById(courseId),
      User.findOne({ email }),
    ]);

    await createOrder(user, course, price, method);
    await createCourseProgress(user, course);
    await addUserToGroupChat(user, course);
    await subscribeUserToPackage(user, course);
    await availUserToReview(user._id);

    let instructorId = null;
    if (course.instructorPercentage && course.instructorPercentage > 0) {
      instructorId = course.instructor;
    }
    await calculateProfits({
      email: user.email,
      amount: price,
      item: `Course: ${course.title}`,
      instructorId: instructorId,
    });

    res.redirect(`https://nexgen-academy.com/`);
  } catch (error) {
    next(error);
  }
});

//end create order course##############$$$$$$$$$$$$$$$$$$$$$$$$%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

//binance implementation

// const apiKey = process.env.BINANCE_API_KEY;
// const apiSecret = process.env.BINANCE_API_SECRET;
// const certificateSerialNumber = process.env.BINANCE_CERT_SN;

// const binancePay = axios.create({
//   baseURL: "https://bpay.binanceapi.com",
//   headers: {
//     "Content-Type": "application/json",
//     "X-MBX-APIKEY": apiKey,
//     "BinancePay-Certificate-SN": certificateSerialNumber, // Add this line
//   },
// });

// const generateSignature = (payload) =>
//   crypto.createHmac("sha512", apiSecret).update(payload).digest("hex");

// const createBinanceOrder = async (
//   amount,
//   currency,
//   description,
//   returnUrl,
//   cancelUrl,
//   merchantTradeNo
// ) => {
//   const data = {
//     amount,
//     currency,
//     description,
//     returnUrl,
//     cancelUrl,
//     merchantTradeNo,
//   };
//   const payload = JSON.stringify(data);
//   const signature = generateSignature(payload);

//   try {
//     const response = await binancePay.post(
//       "/binancepay/openapi/v2/order",
//       data,
//       {
//         headers: {
//           "BinancePay-Timestamp": Date.now(),
//           "BinancePay-Nonce": Math.random().toString(36).substring(7),
//           "BinancePay-Signature": signature,
//         },
//       }
//     );
//     return response.data;
//   } catch (error) {
//     if (error.response) {
//       if (error.response.status === 451) {
//         console.error(
//           "Service unavailable due to legal reasons. Please check your IP restrictions or contact Binance support."
//         );
//       } else {
//         console.error("Error creating Binance Pay order:", error.response.data);
//       }
//     } else {
//       console.error("Error creating Binance Pay order:", error.message);
//     }
//     throw error;
//   }
// };

// // Course Checkout Session using Binance Pay
// exports.courseCheckoutSessionBinance = asyncHandler(async (req, res, next) => {
//   const { courseId } = req.params;
//   const { user } = req;
//   const course = await Course.findById(courseId);

//   if (!course) {
//     return next(new ApiError("There's no course", 404));
//   }

//   const existOrder = await Order.findOne({
//     user: user._id,
//     course: course._id,
//   });
//   if (existOrder) {
//     return next(new ApiError("You already bought this course", 400));
//   }

//   const coursePrice = course.priceAfterDiscount || course.price;
//   const totalOrderPrice = Math.ceil(coursePrice);

//   // check if user can buy this course or Not
//   await checkCourseAccess(user, courseId);

//   const merchantTradeNo = `${courseId.toString()}|${user.email}|course`;

//   try {
//     const binanceOrder = await createBinanceOrder(
//       totalOrderPrice.toString(),
//       "USD",
//       course.title,
//       `https://api.nexgen-academy.com/api/v1/orders/capture-binance-payment`,
//       `http://your-domain.com/checkout-cancel`,
//       merchantTradeNo // Include merchantTradeNo here
//     );

//     res.status(200).json({
//       status: "success",
//       orderId: binanceOrder.orderId,
//       redirectUrl: binanceOrder.qrContent, // URL for Binance Pay QR code
//     });
//   } catch (err) {
//     return next(
//       new ApiError(`Binance order creation failed: ${err.message}`, 500)
//     );
//   }
// });

// // Course Package Checkout Session using Binance Pay
// exports.coursePackageCheckoutSessionBinance = asyncHandler(
//   async (req, res, next) => {
//     const { coursePackageId } = req.params;
//     const { user } = req;
//     const coursePackage = await CoursePackage.findById(coursePackageId);
//     if (!coursePackage) {
//       return next(new ApiError("There's no course Package", 404));
//     }

//     const coursePackagePrice =
//       coursePackage.priceAfterDiscount || coursePackage.price;
//     const totalOrderPrice = Math.ceil(coursePackagePrice);

//     const merchantTradeNo = `${coursePackageId.toString()}|${
//       user.email
//     }|coursePackage`;

//     try {
//       const binanceOrder = await createBinanceOrder(
//         totalOrderPrice.toString(),
//         "USD",
//         `Purchase of Course Package: ${coursePackage.title}`,
//         `https://api.nexgen-academy.com/api/v1/orders/capture-binance-payment`,
//         `http://nexgen-academy.com/checkout-cancel`,
//         merchantTradeNo // Include merchantTradeNo here
//       );

//       res.status(200).json({
//         status: "success",
//         orderId: binanceOrder.orderId,
//         redirectUrl: binanceOrder.qrContent, // URL for Binance Pay QR code
//       });
//     } catch (err) {
//       return next(
//         new ApiError(`Binance order creation failed: ${err.message}`, 500)
//       );
//     }
//   }
// );

// // Package Checkout Session using Binance Pay
// exports.packageCheckoutSessionBinance = asyncHandler(async (req, res, next) => {
//   const { packageId } = req.params;
//   const { user } = req;
//   const package = await Package.findById(packageId);
//   if (!package) {
//     return next(new ApiError("There's no Package", 404));
//   }

//   const packagePrice = package.priceAfterDiscount || package.price;
//   const totalOrderPrice = Math.ceil(packagePrice);

//   const merchantTradeNo = `${packageId.toString()}|${user.email}|package`;

//   try {
//     const binanceOrder = await createBinanceOrder(
//       totalOrderPrice.toString(),
//       "USD",
//       package.title,
//       `https://api.nexgen-academy.com/api/v1/orders/capture-binance-payment`,
//       `http://nexgen-academy.com/checkout-cancel`,
//       merchantTradeNo // Include merchantTradeNo here
//     );

//     res.status(200).json({
//       status: "success",
//       orderId: binanceOrder.orderId,
//       redirectUrl: binanceOrder.qrContent, // URL for Binance Pay QR code
//     });
//   } catch (err) {
//     return next(
//       new ApiError(`Binance order creation failed: ${err.message}`, 500)
//     );
//   }
// });

// // Capture Binance Payment
// exports.captureBinancePayment = asyncHandler(async (req, res, next) => {
//   const { token } = req.query;

//   try {
//     const response = await binancePay.get(
//       `/binancepay/openapi/v2/order/${token}`
//     );

//     if (response.data.status === "PAID") {
//       const [referenceId, userEmail, type] =
//         response.data.merchantTradeNo.split("|");
//       const price = response.data.totalFee;

//       if (type === "course") {
//         res.redirect(
//           `https://api.nexgen-academy.com/api/v1/orders/courseOrder/${referenceId}/${price}/${userEmail}`
//         ); // Redirect the user to a success page
//       } else if (type === "package") {
//         res.redirect(
//           `https://api.nexgen-academy.com/api/v1/orders/packageOrder/${referenceId}/${price}/${userEmail}`
//         ); // Redirect the user to a success page
//       } else if (type === "coursePackage") {
//         res.redirect(
//           `https://api.nexgen-academy.com/api/v1/orders/coursePackageOrder/${referenceId}/${price}/${userEmail}`
//         ); // Redirect the user to a success page
//       }
//     } else {
//       console.error("Payment capture failed", response.data);
//       res.redirect("/error-page"); // Redirect the user to an error page
//     }
//   } catch (err) {
//     console.error("Payment capture error", err);
//     return next(new ApiError(`Payment capture failed: ${err.message}`, 500));
//   }
// });

// cryptomus
//|||*************************************

const apiKey = process.env.CRYPTOMUS_API_KEY;
const merchantId = process.env.CRYPTOMUS_MERCHANT_ID;

const RandomUnique = async () => {
  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear() % 100;
  const hour = currentDate.getHours();
  const minute = currentDate.getMinutes();
  const second = currentDate.getSeconds();
  return `${day}${month}${year}${hour}${minute}${second}`;
};

// const cryptomus = axios.create({
//   baseURL: "https://api.cryptomus.com",
//   headers: {
//     "Content-Type": "application/json",
//     Authorization: `Bearer ${apiKey}`,
//   },
// });

const createCryptomusOrder = async (amount, currency, additionalData) => {
  const data = {
    amount,
    currency,
    order_id: await RandomUnique(),
    additional_data: additionalData,
    url_callback:
      'https://api.nexgen-academy.com/api/v1/orders/webhook/cryptomus',
  };

  console.log(data);
  const jsonData = JSON.stringify(data);
  const sign = crypto
    .createHash('md5')
    .update(Buffer.from(jsonData).toString('base64') + apiKey)
    .digest('hex');

  try {
    const response = await axios.post(
      'https://api.cryptomus.com/v1/payment',
      jsonData, // already replaced
      {
        headers: {
          'Content-Type': 'application/json',
          merchant: merchantId,
          sign: sign,
        },
      },
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error(`Cryptomus API error: ${error.response}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Cryptomus API request error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an error
      console.error('Cryptomus API setup error:', error.message);
    }
    throw new Error(`Cryptomus order creation failed: ${error.message}`);
  }
};

// Course Checkout Session using Cryptomus
exports.courseCheckoutSessionCryptomus = asyncHandler(
  async (req, res, next) => {
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
      return next(new ApiError('You already bought this course', 400));
    }

    const coursePrice = course.priceAfterDiscount || course.price;
    const totalOrderPrice = Math.ceil(coursePrice);

    // check if user can buy this course or Not
    await checkCourseAccess(user, courseId);

    const additionalData = `${courseId}|${user.email}|course`;
    const currency = 'USD';

    try {
      const cryptomusOrder = await createCryptomusOrder(
        totalOrderPrice.toString(),
        currency,
        additionalData,
      );
      console.log('cryptomusOrder', cryptomusOrder);
      res.status(200).json({
        status: 'success',
        redirectUrl: cryptomusOrder.result.url, // URL for Cryptomus payment
      });
    } catch (err) {
      return next(
        new ApiError(`Cryptomus order creation failed: ${err.message}`, 500),
      );
    }
  },
);

// Course Package Checkout Session using Cryptomus
exports.coursePackageCheckoutSessionCryptomus = asyncHandler(
  async (req, res, next) => {
    const { coursePackageId } = req.params;
    const { user } = req;
    const coursePackage = await CoursePackage.findById(coursePackageId);
    if (!coursePackage) {
      return next(new ApiError("There's no course Package", 404));
    }

    const coursePackagePrice =
      coursePackage.priceAfterDiscount || coursePackage.price;
    const totalOrderPrice = Math.ceil(coursePackagePrice);

    const additionalData = `${coursePackageId}|${user.email}|coursePackage`;
    const currency = 'USD';

    try {
      const cryptomusOrder = await createCryptomusOrder(
        totalOrderPrice.toString(),
        currency,
        additionalData,
      );
      res.status(200).json({
        status: 'success',
        redirectUrl: cryptomusOrder.result.url, // URL for Cryptomus payment
      });
    } catch (err) {
      return next(
        new ApiError(`Cryptomus order creation failed: ${err.message}`, 500),
      );
    }
  },
);

// Package Checkout Session using Cryptomus
exports.packageCheckoutSessionCryptomus = asyncHandler(
  async (req, res, next) => {
    const { packageId } = req.params;
    const { user } = req;
    const package = await Package.findById(packageId);
    if (!package) {
      return next(new ApiError("There's no Package", 404));
    }

    const packagePrice = package.priceAfterDiscount || package.price;
    const totalOrderPrice = Math.ceil(packagePrice);

    const additionalData = `${packageId}|${user.email}|package`;
    const currency = 'USD';

    try {
      const cryptomusOrder = await createCryptomusOrder(
        totalOrderPrice.toString(),
        currency,
        additionalData,
      );
      res.status(200).json({
        status: 'success',
        redirectUrl: cryptomusOrder.result.url, // URL for Cryptomus payment
      });
    } catch (err) {
      return next(
        new ApiError(`Cryptomus order creation failed: ${err.message}`, 500),
      );
    }
  },
);
// Webhook handler for Cryptomus payment notifications

exports.cryptomusWebhook = asyncHandler(async (req, res, next) => {
  const { sign, status, amount } = req.body;
  const additionalData = req.body.additional_data;

  // if (!sign) {
  //   console.error("Invalid request: missing sign");
  //   return res.status(400).json({ message: "Invalid request" });
  // }
  // const data = JSON.parse(req.rawBody);

  // delete data.sign;

  // const hash = crypto
  //   .createHash("md5")
  //   .update(Buffer.from(data).toString("base64") + apiKey)
  //   .digest("hex");

  // if (hash !== sign) {
  //   console.error("Invalid Sign");
  //   return res.status(400).json({ message: "Invalid Sign" });
  // }

  if (status === 'confirm_check') {
    const [referenceId, userEmail, type] = additionalData.split('|');
    const price = amount;

    console.log(
      ` Payment details: referenceId=${referenceId}, userEmail=${userEmail}, type=${type}, price=${price}`,
    );

    const baseRedirectUrl = 'https://api.nexgen-academy.com/api/v1/orders/';
    let redirectUrl = '';
    switch (type) {
      case 'course':
        redirectUrl = `${baseRedirectUrl}courseOrder/${referenceId}/${price}/${userEmail}/crypto`;
        break;
      case 'package':
        redirectUrl = `${baseRedirectUrl}packageOrder/${referenceId}/${price}/${userEmail}/crypto`;
        break;
      case 'coursePackage':
        redirectUrl = `${baseRedirectUrl}coursePackageOrder/${referenceId}/${price}/${userEmail}/crypto`;
        break;
      default:
        console.error(`Unknown type: ${type}`);
        return res.redirect('/error-page');
    }
    console.log(`Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);

    console.log('Order updated successfully:', status);
  } else if (status === 'wrong_amount') {
    //TODO:handle the wrong amount case
    console.error('Payment amount is incorrect. Status:', status);
  } else {
    console.error('Payment was not successful. Status:', status);
  }

  // Acknowledge the webhook receipt
  res.status(200).send('Webhook received successfully');
});
