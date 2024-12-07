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
  // createCourseOrder,
  // createCoursePackageOrder,
  // createPackageOrder,
} = require('../services/orders/OrderService');
// ---------------------  Cryptomus  ---------------------
const {
  courseCheckoutSessionCryptomus,
  coursePackageCheckoutSessionCryptomus,
  packageCheckoutSessionCryptomus,
  cryptomusWebhook,
} = require('../services/orders/cryptomus');
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
router
  .route('/:id')
  .get(
    authServices.protect,
    authServices.allowedTo('admin', 'user'),
    findSpecificOrder,
  );
//--------------------Cryptomus----------------
router.put(
  '/cryptomus/course-checkout/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  courseCheckoutSessionCryptomus,
);
router.put(
  '/cryptomus/course-package-checkout/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  coursePackageCheckoutSessionCryptomus,
);
router.put(
  '/cryptomus/package-checkout/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  checkExistingPaidOrder,
  packageCheckoutSessionCryptomus,
);
router.post(
  '/webhook/cryptomus',
  express.raw({ type: 'application/json' }),
  cryptomusWebhook,
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
  checkExistingPaidOrder,
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  packageCheckoutSessionLahza,
);
router.post(
  '/webhook/lahza',
  express.raw({ type: 'application/json' }),
  lahzaWebhook,
);

module.exports = router;
