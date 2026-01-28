const stripe = require('stripe')(process.env.STRIPE_SECRET);
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

//Create Stripe Checkout Session
const createStripeCheckoutSession = async ({
  locale,
  unitAmount,
  productName,
  customerEmail,
  clientReferenceId,
  metadata = {},
  currency = 'USD',
  successUrl = `https://nexgen-academy.com/${locale}/profile?status=success`,
  cancelUrl = `https://nexgen-academy.com/${locale}/profile?status=cancelled`,
}) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          unit_amount: unitAmount,
          currency,
          product_data: {
            name: productName,
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    client_reference_id: clientReferenceId,
    metadata,
  });

  return session;
};

// Export the function for reuse
exports.createStripeCheckoutSession = createStripeCheckoutSession;

exports.courseCheckoutSessionStripe = async (req, res, next) => {
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
      return next(new ApiError('You already bought this course', 400));
    }

    let totalOrderPrice = course.priceAfterDiscount || course.price;
    //check if there is coupon
    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      // Check if coupon can be applied to this course
      const scopeValidation = canCouponApplyToScope(coupon, 'course', courseId);
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }

    totalOrderPrice = Math.ceil(totalOrderPrice * 100);

    const metadata = {
      type: 'course',
      couponName: req.body.couponName || null,
    };

    const session = await createStripeCheckoutSession({
      locale: req.locale,
      unitAmount: totalOrderPrice,
      productName: course.title.en || course.title.ar,
      customerEmail: req.user.email,
      clientReferenceId: courseId,
      metadata,
    });

    //4) send session to response
    res.status(200).json({ status: 'success', session });
  } catch (err) {
    console.log(err);
    next(new ApiError(`Internal Server Error ${err.message}`, 500));
  }
};
exports.packageCheckoutSessionStripe = async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const { user } = req;
    const package = await Package.findById(packageId);
    if (!package) {
      return next(new ApiError("There's no Package", 404));
    }

    let totalOrderPrice = package.priceAfterDiscount || package.price;

    //check if there is coupon
    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      // Check if coupon can be applied to this package
      const scopeValidation = canCouponApplyToScope(
        coupon,
        'package',
        packageId,
      );
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }

    totalOrderPrice = Math.ceil(totalOrderPrice * 100);

    const metadata = {
      type: 'package',
      couponName: req.body.couponName || null,
    };

    const session = await createStripeCheckoutSession({
      locale: req.locale,
      unitAmount: totalOrderPrice,
      productName: package.title.en || package.title.ar,
      customerEmail: req.user.email,
      clientReferenceId: packageId,
      metadata,
    });

    //4) send session to response
    res.status(200).json({ status: 'success', session });
  } catch (err) {
    console.log(err);
    next(new ApiError(`Internal Server Error ${err.message}`, 500));
  }
};
exports.coursePackageCheckoutSessionStripe = async (req, res, next) => {
  try {
    const { coursePackageId } = req.params;
    const { user } = req;
    const coursePackage = await CoursePackage.findById(coursePackageId);
    if (!coursePackage) {
      return next(new ApiError("There's no course Package", 404));
    }

    let totalOrderPrice =
      coursePackage.priceAfterDiscount || coursePackage.price;

    //check if there is coupon
    if (req.body.couponName) {
      const coupon = await validateCoupon(req.body.couponName, user.invitor);

      if (typeof coupon === 'string') {
        return next(new ApiError(res.__(coupon), 400));
      }

      // Check if coupon can be applied to this course package
      const scopeValidation = canCouponApplyToScope(
        coupon,
        'coursePackage',
        coursePackageId,
      );
      if (!scopeValidation.canApply) {
        return next(new ApiError(scopeValidation.errorMessage, 400));
      }

      totalOrderPrice -= (totalOrderPrice * coupon.discount) / 100;
    }

    totalOrderPrice = Math.ceil(totalOrderPrice * 100);

    const metadata = {
      type: 'coursePackage',
      couponName: req.body.couponName || null,
    };

    const session = await createStripeCheckoutSession({
      locale: req.locale,
      unitAmount: totalOrderPrice,
      productName: coursePackage.title.en || coursePackage.title.ar,
      customerEmail: req.user.email,
      clientReferenceId: coursePackageId,
      metadata,
    });

    //4) send session to response
    res.status(200).json({ status: 'success', session });
  } catch (err) {
    console.log(err);
    next(new ApiError(`Internal Server Error ${err.message}`, 500));
  }
};
exports.stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // Use rawBody if available (from express.raw()), otherwise use body
  const rawBody =
    req.body instanceof Buffer ? req.body : req.rawBody || req.body;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;

      // Validate metadata exists
      if (!session.metadata || !session.metadata.type) {
        console.error('Missing metadata.type in session:', session.id);
        return res.status(400).json({
          status: 'error',
          message: 'Missing metadata.type in session',
        });
      }

      const { type } = session.metadata;

      // Validate required fields
      if (!session.client_reference_id || !session.customer_email) {
        console.error('Missing required fields in session:', {
          client_reference_id: session.client_reference_id,
          customer_email: session.customer_email,
        });
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields in session',
        });
      }

      const paymentDetails = {
        id: session.client_reference_id,
        email: session.customer_email,
        price: session.amount_total / 100,
        method: 'stripe',
        couponName: session.metadata.couponName || null,
      };

      // Handle different order types
      switch (type) {
        case 'course':
          await createCourseOrderHandler(paymentDetails);
          break;
        case 'package':
          await createPackageOrderHandler(paymentDetails);
          break;
        case 'coursePackage':
          await createCoursePackageOrderHandler(paymentDetails);
          break;
        default:
          console.error(`Unknown type: ${type}`);
          return res.status(400).json({
            status: 'error',
            message: `Unknown order type: ${type}`,
          });
      }

      // Return success response
      return res.status(200).json({ status: 'success' });
    } catch (err) {
      console.error('Error processing webhook:', err);
      // Return 200 to acknowledge receipt, but log the error
      // This prevents Stripe from retrying the webhook
      return res.status(200).json({
        status: 'error',
        message: 'Error processing webhook',
        error: err.message,
      });
    }
  } else {
    // Handle other event types
    console.log(`Unhandled event type: ${event.type}`);
    return res.status(200).json({
      status: 'success',
      message: `Event type ${event.type} received but not processed`,
    });
  }
};
