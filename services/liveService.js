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
  console.log(id);
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

  //get html template
  try {
    const emailPromises = users.map(async (follower) => {
      const emailMessage = req.body.info
        ? req.body.info
        : `نود أن نخبرك بأن البث المباشر سيبدأ قريباً، كن مستعداً`;
      const htmlEmail = this.getHtmlTemplate(follower, live, emailMessage);
      await sendEmail({
        to: follower.email,
        subject: `Remember the live ${live.title.en}`,
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

exports.getHtmlTemplate = (user, live, emailMessage, lang) => `
  <!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Live Session Reminder</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1F2937;
            margin: 0;
            padding: 0;
            background-color: #F3F4F6;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 600px;
            margin: 40px auto;
            background: #FFFFFF;
            border-radius: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            padding: 40px;
        }

        .header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 32px;
            border-bottom: 1px dashed #E5E7EB;
        }

        .logo {
            display: inline-block;
            margin-bottom: 24px;
        }

        .logo img {
            height: 100px;
            border-radius: 12px;
        }

        h1 {
            color: #1F2937;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
            letter-spacing: -0.02em;
        }

        .subtitle {
            color: #4B5563;
            font-size: 16px;
            margin-top: 8px;
        }

        .live-banner {
            position: relative;
            margin: 32px 0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .live-image {
            width: 100%;
            height: 240px;
            object-fit: cover;
            border-radius: 16px;
        }

        .live-badge {
            position: absolute;
            top: 16px;
            left: 16px;
            background: #EF4444;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .pulse {
            width: 8px;
            height: 8px;
            background-color: white;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
            }

            70% {
                transform: scale(1);
                box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
            }

            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
            }
        }

        .live-details {
            padding: 24px;
            background: linear-gradient(135deg, #F2F8FF 0%, #FFFFFF 100%);
            border-radius: 16px;
            margin: 24px 0;
            border: 1px solid rgba(0, 132, 255, 0.1);
        }

        .live-title {
            font-size: 24px;
            font-weight: 700;
            color: #1F2937;
            margin-bottom: 12px;
        }

        .live-description {
            color: #4B5563;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }

        .host-info {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background-color: white;
            border-radius: 12px;
            margin-top: 24px;
        }

        .host-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
        }

        .host-details {
            flex: 1;
        }

        .host-name {
            font-weight: 600;
            color: #1F2937;
            margin-bottom: 4px;
        }

        .host-title {
            color: #4B5563;
            font-size: 14px;
        }

        .time-info {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 24px;
            padding: 16px;
            background-color: #6366F1;
            color: white;
            border-radius: 12px;
        }

        .icon {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 8px;
            vertical-align: middle;
        }

        .cta-button {
            display: block;
            background-color: #0084FF;
            color: #FFF !important;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 24px;
            text-align: center;
            transition: all 0.2s ease;
        }

        .cta-button:hover {
            background-color: #0066CC;
        }

        .footer {
            text-align: center;
            color: #4B5563;
            font-size: 14px;
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px dashed #E5E7EB;
        }

        .social-links {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
        }

        .social-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background-color: #F2F8FF;
            color: #0084FF;
            transition: all 0.2s ease;
        }

        .social-link:hover {
            background-color: #0084FF;
            color: white;
        }

        @media (max-width: 600px) {
            .container {
                margin: 20px;
                padding: 24px;
            }

            h1 {
                font-size: 24px;
            }

            .live-image {
                height: 180px;
            }

            .live-title {
                font-size: 20px;
            }
        }
    </style>
</head>

<body
dir="${lang === "ar" ? "rtl" : "ltr"}"
>
    <div class="container">
        <div class="header">
            <div class="logo">
                <img src="https://nexgen-academy.com/logos/visa.png" alt="NextGen Academy" />
            </div>
            <h1>
            ${lang === "ar" ? "تذكير للبث المباشر" : "Live Session Reminder"}
            </h1>
            <div class="subtitle">${lang === "ar" ? "البث المباشر سيبدأ قريباً" : "Your live session is starting soon!"}</div>
        </div>

                <p>${lang === "ar" ? "مرحبا بك" : "Hello"} ${user.name}</p>


        <p>${emailMessage}</p>

        <div class="live-details">
            <div class="live-title">${lang === "ar" ? live.title.ar : live.title.en}</div>

            <div class="time-info">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${lang === "ar" ? "البث سيبدأ قريباً" : "Starting in"} ${Math.floor((live.date - new Date()) / 60000)} ${lang === "ar" ? "دقيقة" : "minutes"}
            </div>

            <div class="host-info">
                <img class="host-avatar" src="${live.instructor.profileImg}"
                    alt="Sarah Brown" />
                <div class="host-details">
                    <div class="host-name">${live.instructor.name}</div>
                </div>
            </div>
        </div>

        <a href="${live.link}" class="cta-button">
        ${lang === "ar" ? "انضم إلى البث المباشر" : "Join Live Session"}
        </a>
    </div>
</body>

</html>
`;
