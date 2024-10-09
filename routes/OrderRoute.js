const express = require('express');
const {
  purchaseForUserValidator,
  queryParamsValidator,
  isAuthToView,
} = require('../utils/validators/orderValidator');
const authServices = require('../services/authServices');
const {
  findSpecificOrder,
  findAllOrders,
  filterOrders,
  courseCheckoutSession,
  packageCheckoutSession,
  coursePackageCheckoutSession,
  capturePayment,
  createCourseOrder,
  createCoursePackageOrder,
  createPackageOrder,
  courseCheckoutSessionCryptomus,
  coursePackageCheckoutSessionCryptomus,
  packageCheckoutSessionCryptomus,
  cryptomusWebhook,
  // captureBinancePayment,
  // courseCheckoutSessionBinance,
  // coursePackageCheckoutSessionBinance,
  // packageCheckoutSessionBinance,
} = require('../services/OrderService');
const { initiateCheckout } = require('../services/mepspayOrder');
const {
  purchaseForUser,
  distributeProfits,
} = require('../services/OrderService2');
//validation

//configure Router
const router = express.Router();
//1
router.get('/courseOrder/:courseId/:price/:email/:method', createCourseOrder);
//2
router.get(
  '/coursePackageOrder/:coursePackageId/:price/:email/:method',
  createCoursePackageOrder,
);
//3
router.get(
  '/packageOrder/:packageId/:price/:email/:method',
  createPackageOrder,
);
//4
router.get('/capture-payment', capturePayment);

//5 purchase for user
router.put(
  '/purchaseForUser',
  authServices.protect,
  authServices.allowedTo('admin'),
  purchaseForUserValidator,
  purchaseForUser,
);
// !!!!  Paypal checkout sessions => 💵 !!!!
//6
router.put(
  '/checkout-session/course/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  courseCheckoutSession,
);
//7
router.put(
  '/checkout-session/package/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  packageCheckoutSession,
);
//8
router.put(
  '/checkout-session/coursePackage/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  coursePackageCheckoutSession,
);
//-------------------------------------------
//9 => not used
router.put(
  '/distribute-profits',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  distributeProfits,
);
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
//-------------------------------------------
router.put(
  '/course-checkout/:courseId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  courseCheckoutSessionCryptomus,
);
router.put(
  '/course-package-checkout/:coursePackageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  coursePackageCheckoutSessionCryptomus,
);
router.put(
  '/package-checkout/:packageId',
  authServices.protect,
  authServices.allowedTo('user', 'admin'),
  packageCheckoutSessionCryptomus,
);
router.post(
  '/webhook/cryptomus',
  express.raw({ type: 'application/json' }),
  cryptomusWebhook,
);
// router.put(
//   "/course-checkout/:courseId",
//   authServices.protect,
//   authServices.allowedTo("user", "admin"),
//   courseCheckoutSessionBinance
// );
// router.put(
//   "/course-package-checkout/:coursePackageId",
//   authServices.protect,
//   authServices.allowedTo("user", "admin"),
//   coursePackageCheckoutSessionBinance
// );
// router.put(
//   "/package-checkout/:packageId",
//   authServices.protect,
//   authServices.allowedTo("user", "admin"),
//   packageCheckoutSessionBinance
// );
// router.get("/capture-binance-payment", captureBinancePayment);

router.route('/mepspay/:courseId').post(authServices.protect, initiateCheckout);

module.exports = router;
