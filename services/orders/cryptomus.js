const axios = require('axios');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const ApiError = require('../../utils/apiError');
const Order = require('../../models/orderModel');
const Course = require('../../models/courseModel');
const Package = require('../../models/packageModel');
const CoursePackage = require('../../models/coursePackageModel');
const { checkCourseAccess } = require('../../utils/validators/courseValidator');





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
  const { status, amount } = req.body;
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
    //handle the wrong amount case
    console.error('Payment amount is incorrect. Status:', status);
  } else {
    console.error('Payment was not successful. Status:', status);
  }

  // Acknowledge the webhook receipt
  res.status(200).send('Webhook received successfully');
});
