const asyncHandler = require("express-async-handler");
const Live = require("../models/liveModel");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const UserSubscription = require("../models/userSubscriptionModel");
const factory = require("./handllerFactory");
const sendEmail = require("../utils/sendEmail");
//@desc get list of Lives
//@route GET /api/v1/categories
//@access public
exports.getLives = factory.getALl(Live);
//@desc get specific Live by id
//@route GET /api/v1/lives/:id
//@access public
exports.getLive = factory.getOne(Live);
//@desc create Live
//@route POST /api/v1/lives
//@access private
exports.createLive = factory.createOne(Live);
//@desc update specific category
//@route PUT /api/v1/lives/:id
//@access private
exports.updateLive = factory.updateOne(Live);
//@desc delete Live
//@route DELETE /api/v1/lives/:id
//@access private
exports.deleteLive = factory.deleteOne(Live);
//@desc filter to get my Lives
//@route Get /api/v1/lives/MyLives
//@access private
exports.createFilterObj = asyncHandler(async (req, res, next) => {
  const filterObject = {};
  const newQuery = { ...req.query };
  // Date filtering logic (applied for both users and admins)
  if (req.query.startDate && req.query.endDate) {
    filterObject.date = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
    //removing the keys from the query
    delete newQuery.startDate;
    delete newQuery.endDate;
  }
  ///----------------
  else if (req.query.day) {
    const dayStart = new Date(req.query.day);
    const dayEnd = new Date(req.query.day);
    dayEnd.setUTCHours(23, 59, 59, 999); // Set to the end of the day
    console.log(dayStart, dayEnd);
    filterObject.date = {
      $gte: dayStart,
      $lte: dayEnd,
    };
    //removing the key from the query
    delete newQuery.day;
  }
  //----------------
  else {
    //exclude lives before last 24hrs
    const last24hrs = new Date();
    last24hrs.setDate(last24hrs.getDate() - 1);
    filterObject.date = { $gte: last24hrs };
  }

  if (req.user.role !== "admin") {
    // Get all packages that the user is subscribed to
    const userSubscriptions = await UserSubscription.find({
      user: req.user._id,
      endDate: { $gte: new Date() },
    });
    if (userSubscriptions.length === 0) {
      return next(new ApiError(res.__("lives-errors.No-Subscription"), 404));
    }
    const packageIds = userSubscriptions.map(
      (subscription) => subscription.package._id
    );

    // Using $elemMatch to match any element in the package array
    filterObject.package = { $in: packageIds };
  }

  req.filterObj = filterObject;
  //reset query params
  req.query = newQuery;
  next();
});

//<----------------------------------->//
exports.SendEmailsToLiveFollowers = asyncHandler(async (req, res, next) => {
  const { id } = req.params; //live id
  const live = await Live.findById(id);
  if (!live) {
    return next(ApiError("Live not found", 404));
  }
  const subscribers = await UserSubscription.find({
    package: { $in: live.package },
    endDate: { $gte: new Date() },
  });
  const usersIds = subscribers.map((subscriber) => subscriber.user);

  const users = await User.find({ _id: { $in: usersIds } });
  const emailMessage = req.body.info
    ? `نود أن نخبرك بأن البث المباشر سيبدأ قريباً، كن مستعداً\nإليك بعض المعلومات التي قد تحتاجها\n ${req.body.info}`
    : `نود أن نخبرك بأن البث المباشر سيبدأ قريباً، كن مستعداً`;

  //get html template
  try {
    const emailPromises = users.map(async (follower) => {
      const htmlEmail = this.getHtmlTemplate(
        follower.name,
        live.title,
        emailMessage
      );
      await sendEmail({
        to: follower.email,
        subject: `Remember the live ${live.title}`,
        html: htmlEmail,
      });
    });

    await Promise.all(emailPromises); // Wait for all email sending operations to complete

    return res.status(200).json({
      success: true,
      message: `email has been sent to all followers of this live`,
    });
  } catch (err) {
    return next(
      new ApiError(`There is a problem with sending emails ${err}`, 500)
    );
  }
});

exports.getHtmlTemplate = (userName, liveTitle, emailMessage) => `
  <!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
      body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
          text-align: center;
      }

      .email-container {
          background-color: #ffffff;
          padding: 20px;
          margin: 40px auto;
          max-width: 600px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }

      .email-header {
          font-size: 24px;
          text-align: center;
          margin-bottom: 20px;
      }

      .email-content {
          font-size: 16px;
          line-height: 1.6;
      }

      .verification-code {
          font-size: 30px;
          font-weight: bold;
          color: #5dddee;
          text-align: center;
          margin: 20px 0;
          background-color: #f4f4f4;
      }

      .email-footer {
          font-size: 14px;
          color: #999999;
          text-align: center;
          margin-top: 30px;
      }

      .logo {
          display: block;
          margin: 0 auto 10px auto;
          max-width: 150px;
      }
  </style>
</head>

<body>
  <div class="email-container">
      <img src="${process.env.LOGO_URL}" alt="${process.env.EMAIL_FROM} Logo" class="logo">
      <div class="email-header">
          ${liveTitle} starts soon
      </div>
      <div class="email-content">
          <p> مرحبا ${userName} </p>
          <p>${emailMessage}</p>
      </div>
      <div class="email-footer">
          <p>Thank you,<br>${process.env.EMAIL_FROM}</p>
      </div>
  </div>
</body>

</html>
`;
