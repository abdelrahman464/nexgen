const mongoose = require("mongoose");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const Package = require("../models/packageModel");
const Post = require("../models/postModel");
const UserSubscription = require("../models/userSubscriptionModel");
const User = require("../models/userModel");
const { uploadSingleFile } = require("../middlewares/uploadImageMiddleware");
const Course = require("../models/courseModel");
const { checkIfPackageHasAllFields } = require("../helpers/packageHelper");
const sendEmail = require("../utils/sendEmail");

//upload course image
exports.uploadPackageImage = uploadSingleFile("image");
//image processing
exports.resizeImage = async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf("."),
    ); // Extract file extension
    const newFileName = `package-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith("image/")) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/packages/${newFileName}`;

      await sharp(file.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(filePath);

      // Update the req.body to include the path for the new  package image
      req.body.image = newFileName;
    } else {
      return next(
        new ApiError(
          "Unsupported file type. Only images are allowed for package.",
          400,
        ),
      );
    }
  }
  next();
};
exports.convertToArray = (req, res, next) => {
  if (req.body.whatWillLearn) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.whatWillLearn)) {
      req.body.whatWillLearn = [req.body.whatWillLearn];
    }
  }
  if (req.body.coursePrerequisites) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.coursePrerequisites)) {
      req.body.coursePrerequisites = [req.body.coursePrerequisites];
    }
  }
  if (req.body.whoThisCourseFor) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.whoThisCourseFor)) {
      req.body.whoThisCourseFor = [req.body.whoThisCourseFor];
    }
  }
  next();
};

exports.filterInstructorPackages = async (req, res, next) => {
  if (req.user.role !== "admin") {
    req.filterObj = { instructor: req.user._id };
  }
  next();
};
//@desc get list of collections
//@route GET /api/v1/collections
//@access public
exports.filterPackages = async (req, res, next) => {
  const isAdmin = req.user && req.user.role === "admin";
  req.filterObj = { status: "active" };
  if (req.query.all || isAdmin) {
    req.filterObj = {};
  }
  if (req.query.keyword) {
    const textPattern = new RegExp(req.query.keyword, "i");
    req.filterObj.$or = [
      { "title.ar": { $regex: textPattern } },
      { "title.en": { $regex: textPattern } },
      { "description.ar": { $regex: textPattern } },
      { "description.en": { $regex: textPattern } },
    ];
  }
  return next();
};
exports.applyObjectFilters = (req, res, next) => {
  req.filterObj = req.filterObj || {};
  const { title, description, keyword } = req.query;
  const orFilters = [];
  if (keyword) {
    const textPattern = new RegExp(keyword, "i");
    orFilters.push(
      { "title.ar": { $regex: textPattern } },
      { "title.en": { $regex: textPattern } },
      { "description.ar": { $regex: textPattern } },
      { "description.en": { $regex: textPattern } },
    );
  }
  if (title) {
    orFilters.push({ "title.ar": title }, { "title.en": title });
  }
  if (description) {
    orFilters.push(
      { "description.ar": description },
      { "description.en": description },
    );
  }
  if (orFilters.length > 0) {
    req.filterObj.$or = [...(req.filterObj.$or || []), ...orFilters];
  }
  return next();
};

exports.getAll = factory.getALl(Package, "Package");
//@desc get specific collection by id
//@route GET /api/v1/collections/:id
//@access public
exports.getOne = factory.getOne(Package);
//@desc create collection
//@route POST /api/v1/collections
//@access private
exports.createOne = async (req, res, next) => {
  const { course } = req.body;
  const courseDoc = await Course.findById(course);
  const isAllowed =
    req.user.role === "admin" ||
    courseDoc.instructor._id.toString() === req.user._id.toString();
  if (!isAllowed) {
    return next(
      new ApiError(
        "You are not allowed to create a package for this course",
        403,
      ),
    );
  }
  req.body.instructor = courseDoc.instructor._id;
  return factory.createOne(Package)(req, res, next);
};

//@desc update specific collection
//@route PUT /api/v1/collections/:id
//@access private
exports.updateOne = async (req, res, next) => {
  try {
    const package = await Package.findById(req.params.id).lean();
    if (!package) {
      return next(
        new ApiError(res.__("errors.Not-Found", { document: "document" }), 404),
      );
    }
    if (req.body.status && req.body.status === "active") {
      //check if this package has all fields
      const missedFields = await checkIfPackageHasAllFields(package, req.body);
      if (missedFields.length > 0) {
        return next(
          new ApiError(
            `you cannot activate this Package, Package has missing required fields: ${missedFields.join(", ")}`,
            400,
          ),
        );
      }
    }
    const result = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!result) {
      return next(new ApiError("Failed to update package", 400));
    }
    const localizedPackage = Package.schema.methods.toJSONLocalizedOnly(
      result,
      req.locale,
    );
    res
      .status(200)
      .json({ status: "updated successfully", data: localizedPackage });
  } catch (error) {
    console.error("Error updating document:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

//@desc delete collection
//@route DELETE /api/v1/collections/:id
//@access private
exports.deleteOne = async (req, res, next) => {
  try {
    await mongoose.connection.transaction(async (session) => {
      // Find and delete the course
      const package = await Package.findByIdAndDelete(req.params.id).session(
        session,
      );

      // Check if course exists
      if (!package) {
        return next(
          new ApiError(`package not found for this id ${req.params.id}`, 404),
        );
      }

      // Delete associated lessons and reviews
      await Promise.all([
        UserSubscription.deleteMany({ package: package._id }).session(session),
        Post.deleteMany({
          package: { $elemMatch: { $eq: package._id } },
        }).session(session),
      ]);
    });

    // Return success response
    res.status(204).send();
  } catch (error) {
    // Handle any transaction-related errors

    if (error instanceof ApiError) {
      // Forward specific ApiError instances
      return next(error);
    }
    // Handle other errors with a generic message
    return next(new ApiError("Error during course deletion", 500));
  }
};

// ──────────────────────────────────────────────
// Subscription renewal reminder emails
// ──────────────────────────────────────────────

const getRenewalEmailHtml = (user, subscription, daysLeft) => `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Renewal Reminder</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1F2937;
      margin: 0;
      padding: 0;
      background-color: #F3F4F6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #FFFFFF;
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      padding: 40px;
    }
    .logo {
      display: block;
      margin: 0 auto 20px auto;
      max-width: 150px;
    }
    .header {
      text-align: center;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      background: #FEF3C7;
      color: #92400E;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .info-box {
      background: #F9FAFB;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6B7280; font-size: 14px; }
    .info-value { font-weight: 600; font-size: 14px; }
    .cta-btn {
      display: block;
      width: 200px;
      margin: 28px auto;
      padding: 14px 0;
      text-align: center;
      background: #4F46E5;
      color: #FFFFFF;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
    }
    .footer {
      text-align: center;
      font-size: 13px;
      color: #9CA3AF;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${process.env.LOGO_URL}" alt="${process.env.EMAIL_FROM}" class="logo">
    <div class="header">تذكير بتجديد الاشتراك</div>
    <p>مرحباً ${user.name}،</p>
    <p>نود تذكيرك بأن اشتراكك سينتهي قريباً. لا تفوّت الفرصة واستمر في رحلتك التعليمية!</p>
    <div style="text-align:center;">
      <span class="badge">⏳ متبقي ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}</span>
    </div>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">الباقة</span>
        <span class="info-value">${subscription.package?.title?.ar || subscription.package?.title?.en || "N/A"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الانتهاء</span>
        <span class="info-value">${new Date(subscription.endDate).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
    </div>
    <a href="${process.env.BASE_URL}" class="cta-btn">تجديد الاشتراك</a>
    <div class="footer">
      <p>شكراً لكونك جزءاً من ${process.env.EMAIL_FROM}</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Finds all subscriptions ending within `daysBeforeExpiry` days and sends
 * a renewal-reminder email to each user.
 * Can be called from a cron job (no req/res) or from an admin API route.
 */
exports.sendSubscriptionRenewalEmails = async (daysBeforeExpiry = 3) => {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

  const expiringSubscriptions = await UserSubscription.find({
    endDate: { $gte: now, $lte: futureDate },
  });

  if (expiringSubscriptions.length === 0) {
    console.log("No expiring subscriptions found");
    return { sent: 0 };
  }
  const userIds = [
    ...new Set(expiringSubscriptions.map((s) => s.user.toString())),
  ];
  const users = await User.find({ _id: { $in: userIds } });
  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  let sent = 0;
  let failed = 0;

  const emailPromises = expiringSubscriptions.map(async (sub) => {
    const user = usersMap.get(sub.user.toString());
    if (!user?.email) return;

    const daysLeft = Math.ceil(
      (new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24),
    );
    const html = getRenewalEmailHtml(user, sub, daysLeft);

    try {
      await sendEmail({
        to: user.email,
        subject: `تذكير: اشتراكك سينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} - ${process.env.EMAIL_FROM}`,
        html,
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(
        `Failed to send renewal email to ${user.email}:`,
        err.message,
      );
    }
  });

  await Promise.all(emailPromises);
  console.log(`Renewal emails — sent: ${sent}, failed: ${failed}`);
  return { sent, failed };
};

exports.sendRenewalEmailsHandler = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 3;
    const result = await exports.sendSubscriptionRenewalEmails(days);
    res.status(200).json({
      status: "success",
      message: `Renewal reminder emails sent`,
      data: result,
    });
  } catch (err) {
    next(new ApiError(err.message, 500));
  }
};
