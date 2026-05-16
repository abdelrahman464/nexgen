const express = require('express');
const {
  purchaseForUserValidator,
  queryParamsValidator,
  isAuthToView,
  checkExistingPaidOrder,
} = require('../utils/validators/orderValidator');
const authServices = require('../services/authServices');
const {
  findSpecificOrder,
  findAllOrders,
  filterOrders,
  getOrderStatistics,
  getOrdersByMonth,
  // createCourseOrder,
  // createCoursePackageOrder,
  // createPackageOrder,
} = require('../services/orders/OrderService');
// ---------------------  Cryptomus  ---------------------
const {
  coursePackageCheckoutSessionPlisio,
  courseCheckoutSessionPlisio,
  packageCheckoutSessionPlisio,
  plisioWebhook,
  plisioPaymentCallback,
} = require('../services/orders/plisio');
//-----------------------Lahza---------------------------
const {
  courseCheckoutSessionLahza,
  packageCheckoutSessionLahza,
  coursePackageCheckoutSessionLahza,
  LahzaPaymentCallback,
  lahzaWebhook,
} = require('../services/orders/lahza');
// ---------------------  Stripe  ---------------------
const {
  courseCheckoutSessionStripe,
  coursePackageCheckoutSessionStripe,
  packageCheckoutSessionStripe,
  stripeWebhook,
} = require('../services/orders/stripe');
// ---------------------  Apple In-App Purchase  ---------------------
const {
  applePurchaseVerify,
  appleWebhook,
} = require('../services/orders/apple');
// ---------------------  purchase For User  ---------------------
const {
  purchaseForUser,
  createUnPaidOrder,
} = require('../services/orders/OrderService2');

//configure Router
const router = express.Router();

//1
// router.get('/courseOrder/:courseId/:price/:email/:method', createCourseOrder);
//2
// router.get(
//   '/coursePackageOrder/:coursePackageId/:price/:email/:method',
//   createCoursePackageOrder,
// );
//3
// router.get(
//   '/packageOrder/:packageId/:price/:email/:method',
//   createPackageOrder,
// );

// purchase for user
router.put(
  '/purchaseForUser',
  // authServices.protect,
  // authServices.allowedTo('admin'),
  // purchaseForUserValidator,
  purchaseForUser,
);
// free courses
router.put('/createUnPaidOrder/:id', authServices.protect, createUnPaidOrder);
//-------------------------------------------
//-----------CRUD Operations-----------------
router
  .route('/')
  .get(
    authServices.protect,
    authServices.allowedTo('user', 'admin'),
    queryParamsValidator,
    isAuthToView,
    filterOrders,
    findAllOrders,
  );
router.get(
  '/statistics',
  authServices.protect,
  authServices.allowedTo('admin'),
  getOrderStatistics,
);
router.get(
  '/byMonth',
  authServices.protect,
  authServices.allowedTo('admin'),
  getOrdersByMonth,
);
router
  .route('/:id')
  .get(
    authServices.protect,
    authServices.allowedTo('admin', 'user'),
    findSpecificOrder,
  );
//--------------------Plisio----------------
router.post('/plisio/payment/callback', plisioPaymentCallback);
router.put(
  '/plisio/courseCheckout/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  courseCheckoutSessionPlisio,
);
router.put(
  '/plisio/coursePackageCheckout/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  coursePackageCheckoutSessionPlisio,
);
router.put(
  '/plisio/packageCheckout/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  packageCheckoutSessionPlisio,
);
router.post(
  '/webhook/plisio',
  express.raw({ type: 'application/json' }),
  plisioWebhook,
);
//-----------------LAHZA-----------------
router.get('/lahza/payment/callback', LahzaPaymentCallback);
router.put(
  '/lahza/courseCheckout/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  courseCheckoutSessionLahza,
);
router.put(
  '/lahza/coursePackageCheckout/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  coursePackageCheckoutSessionLahza,
);
router.put(
  '/lahza/packageCheckout/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  packageCheckoutSessionLahza,
);
router.post(
  '/webhook/lahza',
  express.raw({ type: 'application/json' }),
  lahzaWebhook,
);
//-----------------STRIPE-----------------
router.put(
  '/stripe/courseCheckout/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  courseCheckoutSessionStripe,
);
router.put(
  '/stripe/coursePackageCheckout/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  coursePackageCheckoutSessionStripe,
);
router.put(
  '/stripe/packageCheckout/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  packageCheckoutSessionStripe,
);
router.post(
  '/webhook/stripe',
  express.raw({ type: "application/json" }),
  stripeWebhook,
);
//-----------------APPLE IN-APP PURCHASE-----------------
// iOS app calls this right after a successful StoreKit transaction.
router.post(
  '/apple/verifyReceipt',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  applePurchaseVerify,
);
// App Store Server Notifications V2 (renewals, refunds, expirations).
// JWS signature is verified inside the handler, so no auth middleware here.
router.post('/webhook/apple', appleWebhook);
module.exports = router;
