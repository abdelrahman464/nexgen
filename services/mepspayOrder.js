const axios = require('axios');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError'); // Assuming you have this utility
const Course = require('../models/courseModel'); // Adjust the path as needed
const Order = require('../models/orderModel'); // Adjust the path as needed
const { checkCourseAccess } = require('../utils/validators/courseValidator');

function createSignature(payload) {
  return crypto
    .createHash('sha256')
    .update(payload + process.env.MEPS_PAY_SECRET)
    .digest('hex');
}

const RandomUnique = function () {
  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear() % 100;
  const hour = currentDate.getHours();
  const minute = currentDate.getMinutes();
  const second = currentDate.getSeconds();
  return `${day}${month}${year}${hour}${minute}${second}`;
};

async function createMpgsOrder(amount, orderId, description) {
  const apiBaseURL = `https://mepspay.gateway.mastercard.com/api/rest/version/72/merchant/${process.env.MPGS_MERCHANT_ID}/session`;

  // Prepare the authorization string by encoding it in Base64
  const authString = Buffer.from(
    `merchant.${process.env.MPGS_MERCHANT_ID}:${process.env.MPGS_API_PASSWORD}`,
  ).toString('base64');

  // Making the POST request
  try {
    const response = await axios.post(
      apiBaseURL,
      {
        apiOperation: 'INITIATE_CHECKOUT',
        interaction: {
          operation: 'PURCHASE',
          merchant: {
            name: process.env.MPGS_MERCHANT_NAME || 'NEXGEN ACADEMY',
          },
        },
        order: {
          currency: 'USD',
          amount: amount,
          id: orderId,
          description: description,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authString}`, // Use the encoded authorization string
        },
      },
    );

    return response.data; // Return the response data
  } catch (error) {
    console.error(
      'Error creating MPGS order:',
      error.response ? error.response.data : error.message,
    );
    throw new Error('Failed to create MPGS order');
  }
}
exports.initiateCheckout = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { user } = req;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ApiError('Course Not Found', 404));
  }

  const existOrder = await Order.findOne({
    user: user._id,
    course: course._id,
  });
  if (existOrder) {
    return next(new ApiError("You've already purchased this course", 400));
  }

  const coursePrice = course.priceAfterDiscount || course.price;
  const totalOrderPrice = Math.ceil(coursePrice);

  await checkCourseAccess(user, courseId);


  const orderId = RandomUnique();
 
  try {
    const sessionData = await createMpgsOrder(
      totalOrderPrice,
      orderId,
      `${course._id}|${user.email}|course`,
    );

    res.status(200).json({
      result: 'SUCCESS',
      session: sessionData,
    });
  } catch (error) {
    return next(new ApiError('Payment initiation failed', 500));
  }
});

// exports.handleCheckoutResponse = asyncHandler(async (req, res, next) => {
//   const { resultIndicator, sessionId } = req.query;

//   try {
//     const response = await mpgsClient().get(
//       `/${config.version}/merchant/${config.merchantId}/order/${sessionId}`,
//     );

//     if (response.data.order.status === 'CAPTURED') {
//       // Payment successful, update your database
//       // Create order in your system
//       // Grant access to the course
//       res.redirect('http://your-domain.com/payment-success');
//     } else {
//       // Payment failed or is pending
//       res.redirect('http://your-domain.com/payment-failed');
//     }
//   } catch (err) {
//     return next(
//       new ApiError(`Payment verification failed: ${err.message}`, 500),
//     );
//   }
// });
