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
const Notification = require("../../models/notificationModel");
const {
  createCourseOrderHandler,
  createPackageOrderHandler,
  createCoursePackageOrderHandler,
  createOrUpdateSubscription,
} = require("./OrderService");

/**
 * Apple In-App Purchase integration.
 *
 * Two entrypoints, mirroring the style used by lahza.js / stripe.js / plisio.js:
 *
 *  1) POST /api/v1/orders/apple/verifyReceipt
 *     Called by the iOS app right after StoreKit returns a successful
 *     transaction. The app sends the base64 receipt + (optionally) the
 *     productId. We verify with Apple, locate the matching Course / Package
 *     / CoursePackage by `appleProductId`, then reuse the existing
 *     order-handler pipeline.
 *
 *  2) POST /api/v1/orders/webhook/apple
 *     App Store Server Notifications V2. Apple POSTs a signed JWS payload
 *     ({ "signedPayload": "..." }) for renewals, refunds, expirations, etc.
 *     We verify the JWS with the leaf certificate from the x5c chain, decode
 *     the inner signedTransactionInfo, and update orders / subscriptions
 *     accordingly.
 *
 * NOTE: For maximum trust in production, install Apple's official
 * `app-store-server-library` (Node) which performs full chain validation
 * to AppleRootCA-G3 and exposes typed helpers. The implementation below is
 * dependency-free (uses Node's built-in `crypto`) and matches the
 * "axios + crypto" style of the other webhooks in this project.
 */

const APPLE_VERIFY_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

// Lookup the product across our three product types using `appleProductId`.
const findItemByAppleProductId = async (productId) => {
  if (!productId) return null;

  const [course, packageDoc, coursePackage] = await Promise.all([
    Course.findOne({ appleProductId: productId }),
    Package.findOne({ appleProductId: productId }),
    CoursePackage.findOne({ appleProductId: productId }),
  ]);

  if (course) return { item: course, type: "course" };
  if (packageDoc) return { item: packageDoc, type: "package" };
  if (coursePackage) return { item: coursePackage, type: "coursePackage" };
  return null;
};

// POST a receipt to Apple and fall back to sandbox on status 21007 (per
// Apple's recommendation for the legacy verifyReceipt endpoint).
const verifyReceiptWithApple = async (receiptData) => {
  if (!process.env.APPLE_SHARED_SECRET) {
    throw new Error("APPLE_SHARED_SECRET not configured");
  }

  const body = {
    "receipt-data": receiptData,
    password: process.env.APPLE_SHARED_SECRET,
    "exclude-old-transactions": true,
  };

  // Try production first.
  let response = await axios.post(APPLE_VERIFY_PROD_URL, body, {
    headers: { "Content-Type": "application/json" },
  });
  
  // 21007: receipt is from sandbox but was sent to production.
  if (response.data && response.data.status === 21007) {
    response = await axios.post(APPLE_VERIFY_SANDBOX_URL, body, {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!response.data || response.data.status !== 0) {
    throw new Error(
      `Apple receipt verification failed (status ${response.data?.status})`
    );
  }

  // Optional bundle-id pinning (defends against receipts from other apps).
  const bundleId = response.data.receipt && response.data.receipt.bundle_id;
  if (
    process.env.APPLE_BUNDLE_ID &&
    bundleId &&
    bundleId !== process.env.APPLE_BUNDLE_ID
  ) {
    throw new Error(
      `Apple receipt bundle_id mismatch (got ${bundleId}, expected ${process.env.APPLE_BUNDLE_ID})`
    );
  }

  return response.data;
};

// Pick the latest in-app purchase for a given productId (or the latest one
// overall when no productId is supplied).
const pickLatestPurchase = (verifiedReceipt, productId) => {
  const candidates =
    (verifiedReceipt.latest_receipt_info &&
      verifiedReceipt.latest_receipt_info.length > 0
      ? verifiedReceipt.latest_receipt_info
      : verifiedReceipt.receipt && verifiedReceipt.receipt.in_app) || [];

  const filtered = productId
    ? candidates.filter((p) => p.product_id === productId)
    : candidates;

  if (filtered.length === 0) return null;

  // purchase_date_ms is a numeric string -> sort desc.
  filtered.sort(
    (a, b) => Number(b.purchase_date_ms || 0) - Number(a.purchase_date_ms || 0)
  );
  return filtered[0];
};

// Idempotency guard: skip if we've already processed this Apple transaction.
const findExistingAppleOrder = (transactionId) =>
  transactionId
    ? Order.findOne({ appleTransactionId: transactionId })
    : Promise.resolve(null);

// Stamp Apple identifiers on the order created by the shared handlers.
const stampAppleIdsOnOrder = async ({
  user,
  itemType,
  itemId,
  transactionId,
  originalTransactionId,
}) => {
  if (!transactionId) return;
  await Order.findOneAndUpdate(
    {
      user: user._id,
      [itemType]: itemId,
      paymentMethodType: "apple",
      appleTransactionId: { $exists: false },
    },
    {
      appleTransactionId: transactionId,
      appleOriginalTransactionId: originalTransactionId || transactionId,
    },
    { sort: { createdAt: -1 } }
  );
};

// ---------------------------------------------------------------------------
//  1) iOS-app-driven verification (POST /apple/verifyReceipt)
// ---------------------------------------------------------------------------

// @desc   Verify a StoreKit receipt and grant access
// @route  POST /api/v1/orders/apple/verifyReceipt
// @access protected (the iOS app calls this with the user's bearer token)
exports.applePurchaseVerify = asyncHandler(async (req, res, next) => {
  const { user } = req;
  const { receiptData, productId } = req.body;

  if (!receiptData) {
    return next(new ApiError("receiptData is required", 400));
  }

  let verified;
  try {
    verified = await verifyReceiptWithApple(receiptData);
  } catch (err) {
    return next(new ApiError(`Apple verification failed: ${err.message}`, 400));
  }

  const purchase = pickLatestPurchase(verified, productId);
  if (!purchase) {
    return next(new ApiError("No matching in-app purchase in receipt", 400));
  }

  const resolvedProductId = purchase.product_id;
  const transactionId = purchase.transaction_id;
  const originalTransactionId =
    purchase.original_transaction_id || transactionId;

  // Idempotency: if we already fulfilled this transaction, just return success.
  const existingOrder = await findExistingAppleOrder(transactionId);
  if (existingOrder) {
    return res.status(200).json({
      status: "success",
      message: "Purchase already processed",
      data: { orderId: existingOrder._id, transactionId },
    });
  }

  // Resolve which product this maps to in our DB.
  const match = await findItemByAppleProductId(resolvedProductId);
  if (!match) {
    return next(
      new ApiError(
        `No course/package/coursePackage configured for appleProductId "${resolvedProductId}"`,
        404
      )
    );
  }

  // Use the receipt's purchase price when available; Apple does not always
  // return the price in the legacy receipt, so fall back to the catalog price.
  const price =
    Number(purchase.price) ||
    Number(match.item.priceAfterDiscount) ||
    Number(match.item.price) ||
    0;

  const paymentDetails = {
    id: match.item._id.toString(),
    email: user.email,
    price,
    method: "apple",
    couponName: null,
  };

  try {
    switch (match.type) {
      case "course":
        await createCourseOrderHandler(paymentDetails);
        break;
      case "package":
        await createPackageOrderHandler(paymentDetails);
        break;
      case "coursePackage":
        await createCoursePackageOrderHandler(paymentDetails);
        break;
      default:
        return next(new ApiError(`Unknown item type: ${match.type}`, 400));
    }
  } catch (err) {
    return next(
      new ApiError(`Failed to fulfill Apple purchase: ${err.message}`, 500)
    );
  }

  await stampAppleIdsOnOrder({
    user,
    itemType: match.type,
    itemId: match.item._id,
    transactionId,
    originalTransactionId,
  });

  return res.status(200).json({
    status: "success",
    message: "Purchase verified and access granted",
    data: {
      productId: resolvedProductId,
      transactionId,
      originalTransactionId,
      type: match.type,
    },
  });
});

// ---------------------------------------------------------------------------
//  2) JWS verification for App Store Server Notifications V2
// ---------------------------------------------------------------------------

const decodeBase64UrlJson = (segment) =>
  JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

// Verify a single JWS string and return its decoded payload.
//
// Validates:
//  - Algorithm is ES256.
//  - Each cert in x5c is signed by the next cert in the chain.
//  - (Optional) The chain roots in APPLE_ROOT_CERT (PEM) when configured.
//  - The leaf cert's public key verifies the signature over header.payload.
const verifyAppleJWS = (jws) => {
  if (typeof jws !== "string" || jws.split(".").length !== 3) {
    throw new Error("Malformed JWS");
  }

  const [headerB64, payloadB64, signatureB64] = jws.split(".");
  const header = decodeBase64UrlJson(headerB64);

  if (header.alg !== "ES256") {
    throw new Error(`Unsupported JWS alg: ${header.alg}`);
  }
  if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
    throw new Error("JWS header missing x5c chain");
  }

  const certs = header.x5c.map(
    (b64) => new crypto.X509Certificate(Buffer.from(b64, "base64"))
  );

  // Validate chain links.
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) {
      throw new Error("Apple JWS certificate chain is broken");
    }
  }

  // Optional: pin the top-most cert to AppleRootCA-G3 (PEM in env).
  if (process.env.APPLE_ROOT_CERT) {
    const root = new crypto.X509Certificate(process.env.APPLE_ROOT_CERT);
    const top = certs[certs.length - 1];
    if (!top.verify(root.publicKey)) {
      throw new Error("Apple JWS does not chain to APPLE_ROOT_CERT");
    }
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, "base64url");

  const ok = crypto.verify(
    "SHA256",
    signingInput,
    { key: certs[0].publicKey, dsaEncoding: "ieee-p1363" },
    signature
  );
  if (!ok) {
    throw new Error("Apple JWS signature verification failed");
  }

  return decodeBase64UrlJson(payloadB64);
};

// ---------------------------------------------------------------------------
//  3) App Store Server Notifications V2 webhook
// ---------------------------------------------------------------------------

// Find the original Order created at initial purchase using the
// originalTransactionId we stamped during verifyReceipt (or a previous
// notification). Returns null when nothing matches yet.
const findOrderByOriginalTransactionId = (originalTransactionId) =>
  Order.findOne({ appleOriginalTransactionId: originalTransactionId });

const fulfillFromTransaction = async (transactionPayload) => {
  const productId = transactionPayload.productId;
  const transactionId = transactionPayload.transactionId;
  const originalTransactionId =
    transactionPayload.originalTransactionId || transactionId;

  // Skip if already processed (e.g. the user's iOS app already verified the
  // initial receipt before the webhook arrived).
  const existing = await findExistingAppleOrder(transactionId);
  if (existing) return existing;

  const match = await findItemByAppleProductId(productId);
  if (!match) {
    throw new Error(
      `No course/package/coursePackage configured for appleProductId "${productId}"`
    );
  }

  // We need a user. The Apple notification itself does not include our user
  // id, so we look up the previous order for this subscription chain (set
  // during the initial verifyReceipt call) and reuse its user.
  const previousOrder = await findOrderByOriginalTransactionId(
    originalTransactionId
  );
  if (!previousOrder) {
    throw new Error(
      `Cannot fulfill Apple transaction ${transactionId}: no prior order ` +
        `for originalTransactionId ${originalTransactionId} (was the initial ` +
        `verifyReceipt call ever made?)`
    );
  }

  const user = await User.findById(previousOrder.user);
  if (!user) {
    throw new Error(`User not found for order ${previousOrder._id}`);
  }

  const price =
    Number(transactionPayload.price) ||
    Number(match.item.priceAfterDiscount) ||
    Number(match.item.price) ||
    0;

  const paymentDetails = {
    id: match.item._id.toString(),
    email: user.email,
    price,
    method: "apple",
    couponName: null,
  };

  switch (match.type) {
    case "course":
      await createCourseOrderHandler(paymentDetails);
      break;
    case "package":
      await createPackageOrderHandler(paymentDetails);
      break;
    case "coursePackage":
      await createCoursePackageOrderHandler(paymentDetails);
      break;
    default:
      throw new Error(`Unknown item type: ${match.type}`);
  }

  await stampAppleIdsOnOrder({
    user,
    itemType: match.type,
    itemId: match.item._id,
    transactionId,
    originalTransactionId,
  });

  return null;
};

const handleRenewal = async (transactionPayload) => {
  const originalTransactionId =
    transactionPayload.originalTransactionId || transactionPayload.transactionId;
  const productId = transactionPayload.productId;

  const previousOrder = await findOrderByOriginalTransactionId(
    originalTransactionId
  );
  if (!previousOrder) {
    console.warn(
      `[apple] DID_RENEW for unknown originalTransactionId ${originalTransactionId}`
    );
    return;
  }

  const match = await findItemByAppleProductId(productId);
  if (!match || match.type !== "package") {
    // Renewals only make sense for our `Package` (subscription) products.
    return;
  }

  await createOrUpdateSubscription(
    previousOrder.user,
    match.item._id,
    match.item.subscriptionDurationDays || 30
  );

  await Notification.create({
    user: previousOrder.user,
    message: {
      en: `Your subscription to ${match.item.title?.en || "the package"} has been renewed`,
      ar: `تم تجديد اشتراكك في ${match.item.title?.ar || "الباقة"}`,
    },
    type: "system",
  });
};

const handleRevokeOrRefund = async (transactionPayload) => {
  const transactionId = transactionPayload.transactionId;
  const originalTransactionId =
    transactionPayload.originalTransactionId || transactionId;

  const order = await findOrderByOriginalTransactionId(originalTransactionId);
  if (!order) {
    console.warn(
      `[apple] REFUND/REVOKE for unknown originalTransactionId ${originalTransactionId}`
    );
    return;
  }

  // Mark the order as no longer paid; the rest of the access logic in this
  // codebase keys off `Order.isPaid` and `UserSubscription.endDate`.
  order.isPaid = false;
  await order.save();

  // End any subscription that this order granted.
  if (order.package) {
    await UserSubscription.updateMany(
      { user: order.user, package: order.package, endDate: { $gt: new Date() } },
      { endDate: new Date() }
    );
  }

  await Notification.create({
    user: order.user,
    message: {
      en: "Your purchase was refunded and access has been revoked",
      ar: "تم استرداد قيمة الشراء وتم إلغاء الوصول",
    },
    type: "system",
  });
};

// @desc   App Store Server Notifications V2 webhook
// @route  POST /api/v1/orders/webhook/apple
// @access public (Apple) — protected by JWS signature verification
exports.appleWebhook = asyncHandler(async (req, res) => {
  const { signedPayload } = req.body || {};
  if (!signedPayload) {
    console.error("[apple] webhook called without signedPayload");
    return res.status(400).json({ error: "Missing signedPayload" });
  }

  let payload;
  try {
    payload = verifyAppleJWS(signedPayload);
  } catch (err) {
    console.error("[apple] webhook JWS verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signedPayload" });
  }

  const data = payload.data || {};

  // Optional bundle-id pinning.
  if (
    process.env.APPLE_BUNDLE_ID &&
    data.bundleId &&
    data.bundleId !== process.env.APPLE_BUNDLE_ID
  ) {
    console.warn(
      `[apple] webhook bundleId mismatch: ${data.bundleId} (expected ${process.env.APPLE_BUNDLE_ID})`
    );
    return res.status(200).json({ status: "ignored" });
  }

  let transactionPayload = {};
  if (data.signedTransactionInfo) {
    try {
      transactionPayload = verifyAppleJWS(data.signedTransactionInfo);
    } catch (err) {
      console.error(
        "[apple] webhook signedTransactionInfo invalid:",
        err.message
      );
      return res.status(400).json({ error: "Invalid signedTransactionInfo" });
    }
  }

  const { notificationType, subtype } = payload;

  try {
    switch (notificationType) {
      case "SUBSCRIBED":
      case "DID_RENEW":
        if (notificationType === "SUBSCRIBED" && subtype === "INITIAL_BUY") {
          // Initial purchase via Apple — fulfill if the iOS app has not
          // already done so via verifyReceipt.
          await fulfillFromTransaction(transactionPayload);
        } else {
          await handleRenewal(transactionPayload);
        }
        break;

      case "ONE_TIME_CHARGE":
        // Non-consumable / non-renewing initial purchase.
        await fulfillFromTransaction(transactionPayload);
        break;

      case "REFUND":
      case "REVOKE":
        await handleRevokeOrRefund(transactionPayload);
        break;

      case "DID_FAIL_TO_RENEW":
      case "EXPIRED":
      case "GRACE_PERIOD_EXPIRED":
        console.log(
          `[apple] subscription ${notificationType} for ` +
            `originalTransactionId ${transactionPayload.originalTransactionId}`
        );
        break;

      default:
        console.log(
          `[apple] unhandled notificationType=${notificationType} subtype=${subtype}`
        );
    }
  } catch (err) {
    console.error("[apple] webhook processing error:", err.message);
    // Always 200 so Apple stops retrying (it would otherwise retry for up to
    // 3 days). The error is logged for follow-up.
    return res.status(200).json({
      status: "error",
      message: "Webhook processed with errors",
    });
  }

  return res.status(200).json({ status: "success" });
});

// Exposed for unit testing.
exports._internal = {
  verifyReceiptWithApple,
  verifyAppleJWS,
  findItemByAppleProductId,
  pickLatestPurchase,
};
