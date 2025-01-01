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
  plisioPaymentCallback
} = require('../services/orders/plisio');
//-----------------------Lahza---------------------------
const {
  courseCheckoutSessionLahza,
  packageCheckoutSessionLahza,
  coursePackageCheckoutSessionLahza,
  LahzaPaymentCallback,
  lahzaWebhook,
} = require('../services/orders/lahza');
// ---------------------  purchase For User  ---------------------
const { purchaseForUser } = require('../services/orders/OrderService2');

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
  authServices.protect,
  authServices.allowedTo('admin'),
  purchaseForUserValidator,
  purchaseForUser,
);
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

module.exports = router;
