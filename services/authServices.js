const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");
const generateToken = require("../utils/generateToken");
const {
  getMarketerFromInvitationKey,
} = require("./marketing/marketingAnalyticsService");
const CourseProgress = require("../models/courseProgressModel");
const Lesson = require("../models/lessonModel");

// @desc    User Register,login with Google
// @route   POST /api/v1/auth/google
// @access  Public
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    asyncHandler(async (req, accessToken, refreshToken, profile, done) => {
      // Find a user by google.id or email in the database
      let existingUser = await User.findOne({
        $or: [{ "google.id": profile.id }, { email: profile.emails[0].value }],
      });

      if (existingUser) {
        // Check if the user has logged in with Google before
        if (!existingUser.google || !existingUser.google.id) {
          // The user exists by email but hasn't logged in with Google before, so update the record
          await User.updateOne(
            { _id: existingUser._id }, // filter
            {
              // update
              $set: {
                "google.id": profile.id,
                "google.email": profile.emails[0].value,
                isOAuthUser: true,
              },
            }
          );
          // After update, it's a good idea to refresh the existingUser object if you plan to use it right after
          existingUser = await User.findById(existingUser._id);
        }
        // Generate a JWT for the (possibly updated) existing user
        const token = generateToken(existingUser._id);
        return done(null, { user: existingUser, token }); // Include token in the user object
      }
      // No user exists by Google ID or email, create a new user
      const newUser = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        google: {
          id: profile.id,
          email: profile.emails[0].value,
        },
        isOAuthUser: true,
        emailVerified: true,
        active: true,
      });
      const token = generateToken(newUser._id);
      done(null, { user: newUser, token }); // Include token in the user object
    })
  )
);
//@desc signup
//@route POST /api/v1/auth/signup
//@access public
exports.signup = asyncHandler(async (req, res, next) => {
  //**2-Handle invitor and treeHead */
  let invitorId = null;
  if (req.body.invitationKey) {
    console.log("invitationKey", req.body.invitationKey);

    //check if invitor is valid
    invitorId = await getMarketerFromInvitationKey(req.body.invitationKey);
    if (!invitorId) {
      return next(new ApiError("this link is invalid", 400));
    }
  } else {
    invitorId = process.env.ADMIN_ID;
  }

  //create user
  const user = await User.create({
    invitor: invitorId,
    invitationKey: req.body.invitationKey,
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    active: true,
    country: req.body.country,
    phone: req.body.phone,
    idNumber: req.body.idNumber,
    idDocuments: req.body.idDocuments,
    profileImg: req.body.profileImg,
    coverImg: req.body.coverImg,
  });
  //send email with reset code to user Gmail account to verify his email
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  const hashedVerificationCode = crypto
    .createHash("sha256")
    .update(verificationCode)
    .digest("hex");

  const htmlEmail = `
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
            Account Verification Code
        </div>
        <div class="email-content">
            <p>Hello, ${user.name}</p>
            <p>We received a request to verify your email on your ${process.env.EMAIL_FROM} Account.
     </p>
            <div class="verification-code">
                ${verificationCode}
            </div>
            <p>enter this code to complete the verification.\n
   </p>
        </div>
        <div class="email-footer">
            <p>Thanks for helping us keep your account secure.,<br>${process.env.EMAIL_FROM}</p>
        </div>
    </div>
</body>

</html>
  `;

  await User.updateOne(
    { email: req.body.email },
    {
      emailVerificationCode: hashedVerificationCode,
      emailVerificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes from now
    }
  );
  await sendEmail({
    to: user.email,
    subject: "Your Email Verification Code (valid for 10 minutes)",
    html: htmlEmail,
  });

  // generate token
  const token = generateToken(user._id);
  // send response to client side
  return res.status(201).json({ data: user, token });
});

//@desc login
//@route POST /api/v1/auth/login
//@access public
exports.login = asyncHandler(async (req, res, next) => {
  //  check if password and email in the body
  //  check if user exist & check if password is correct
  const user = await User.findOne({ email: req.body.email });
  // if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
  //   return next(new ApiError("incorrect password or email", 401));
  // }
  // generate token
  // const token = generateToken(user._id);
  const token = generateToken("67b08485f9f7ee0e27185edc");

  //exclude sensitive data
  user.idDocuments = undefined;

  // send response to client side
  res.status(200).json({ data: user, token });
});
//check if user need to verify his id
//check if user completed 50% of any random course he enrolled in
const checkIfUserNeedToVerifyId = async (user) => {
  // Admin users never need verification
  if (user.role === "admin") {
    return false;
  }

  // If user is already verified, no need to check
  if (user.idVerification === "verified") {
    return false;
  }

  try {
    // Find the user's course progress
    const courseProgress = await CourseProgress.findOne({
      user: user._id,
      course: "664697c2ecf273280314ecab",
    })
      .select("course progress")
      .lean();

    // If no course progress exists, no verification needed yet
    if (!courseProgress) {
      return false;
    }

    // Count total lessons in the course
    const totalLessons = await Lesson.countDocuments({
      course: courseProgress.course,
    }).lean();

    // If no lessons exist in course, no verification needed
    if (!totalLessons || totalLessons === 0) {
      return false;
    }

    // Calculate completed lessons
    const completedLessons = courseProgress.progress.filter(
      (lesson) => lesson.status === "Completed"
    ).length;
    // Check if completed at least 50% of lessons
    const hasCompletedHalf = completedLessons >= Math.ceil(totalLessons / 2);
    return hasCompletedHalf;
  } catch (err) {
    console.error("Error in checkIfUserNeedToVerifyId:", err);
    // Fail-safe: return true to require verification if any error occurs
    return true;
  }
};
//@desc make sure user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  //1- check if token exists, if exist get it
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new ApiError("you are not login,please login first", 401));
  }
  //2- verify token (no change happens,expired token)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  // 3- Check if user exists
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(new ApiError("User no longer exists", 401));
  }
  //4-check if user changed password after token generated
  if (currentUser.passwordChangedAt) {
    //convert data to timestamp by =>getTime()
    const passwordChangedTimestamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10
    );
    //it mean password changer after token generated
    if (passwordChangedTimestamp > decoded.iat) {
      return next(
        new ApiError(
          "user recently changed his password,please login again",
          401
        )
      );
    }
  }
  //5-check if user is active

  if (!currentUser.emailVerified) {
    return next(new ApiError("Please Active Your Email", 407));
  }
  //5-check if user is active
  if (!currentUser.active) {
    return next(new ApiError("You Are Not Active", 405));
  }

  // if (
  //   currentUser.idVerification !== 'verified' &&
  //   currentUser.role !== 'admin'
  // ) {
  //   return next(new ApiError('You Are Not Verified Your ID Document', 406));
  // }
  //id verification
  const isUserNeedToVerifyId = await checkIfUserNeedToVerifyId(currentUser);
  if (isUserNeedToVerifyId) {
    return next(new ApiError("You Are Not Verified Your ID Document", 406));
  }
  //add user to request
  //to use this in authorization
  // check if user is already registered
  req.user = currentUser;

  next();
});
//@desc optional auth
//@route GET /api/v1/auth/optionalAuth
//@access public
exports.optionalAuth = async (req, res, next) => {
  const token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await User.findById(decoded.userId);
      req.user = user;
    } catch (err) {
      // Token invalid, continue without user
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};
//@desc  Authorization (user permissions)
// ....roles => retrun array for example ["admin","manager"]
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    //1- access roles
    //2- access registered user (req.user.role)
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("you are not allowed to access this route", 403)
      );
    }
    next();
  });
//@desc forgot password
//@route POST /api/v1/auth/forgotPassword
//@access public

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1-Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with email ${req.body.email}`, 404)
    );
  }

  // 2-If user exists, generate random 6 digits and hash it
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  // Define update fields
  const updateFields = {
    passwordResetCode: hashedResetCode,
    passwordResetExpires: Date.now() + 10 * 60 * 1000, // 10 minutes from now
    passwordResetVerified: false,
  };

  // Update user with the reset code and expiration time
  await User.updateOne({ email: req.body.email }, updateFields);

  // HTML email template
  const htmlEmail = `
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
            Password Reset Verification Code
        </div>
        <div class="email-content">
            <p>Hello, ${user.name}</p>
            <p>We received a request to reset your password. Use the verification code below to complete the process:
            </p>
            <div class="verification-code">
                ${resetCode}
            </div>
            <p>If you did not request a password reset, please ignore this email.</p>
        </div>
        <div class="email-footer">
            <p>Thank you,<br>${process.env.EMAIL_FROM}</p>
        </div>
    </div>
</body>

</html>
  `;

  // 3-Send the reset code via email
  try {
    await sendEmail({
      to: user.email,
      subject: "Your Password Reset Code (valid for 10 minutes)",
      html: htmlEmail,
    });

    res.status(200).json({
      status: "success",
      message: `Reset Code Sent Successfully To ${user.email}`,
    });
  } catch (err) {
    // Remove reset fields if email sending fails
    await User.updateOne(
      { email: req.body.email },
      {
        $unset: {
          passwordResetCode: "", // Remove passwordResetCode
          passwordResetExpires: "", // Remove passwordResetExpires
          passwordResetVerified: "", // Remove passwordResetVerified
        },
      }
    );
    return next(new ApiError(err.message, 500));
  }
});
//@desc verify reset password code
//@route POST /api/v1/auth/verifyResetCode
//@access public
exports.verifyPassResetCode = asyncHandler(async (req, res, next) => {
  // 1-Get user based on reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");
  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    // Check if the reset code is valid
    // If reset code expire date is greater than Date.now() then reset code is valid
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError("Reset code invalid or expired", 400));
  }

  // 2- Reset code is valid
  await User.updateOne({ _id: user._id }, { passwordResetVerified: true });

  res.status(200).json({ status: "success" });
});
//@desc verify email code
//@route POST /api/v1/auth/verifyEmailCode
//@access public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { code } = req.body;
  // 1-Get user based on email code
  const hashedEmailCode = crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
  const user = await User.findOne({
    emailVerificationCode: hashedEmailCode,
    // Check if the email code is valid
    // If email code expire date is greater than Date.now() then email code is valid
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError("Email code invalid or expired", 400));
  }
  // 2- Email code is valid
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerified: true,
        active: true,
      },
      $unset: {
        emailVerificationCode: "", // Use $unset to remove the fields
        emailVerificationExpires: "",
      },
    }
  );

  res.status(200).json({ status: "success" });
});
//@desc get new email code and send it to user
//@route POST /api/v1/auth/resendEmailCode
//@access public
exports.resendEmailCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  // 1-Get user by email
  const user = await User.findOne({
    email,
    emailVerified: false,
  });
  if (!user) {
    return next(
      new ApiError(
        `There is no user with email ${email} or email already verified`,
        404
      )
    );
  }

  //  Generate new email code and hash it
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  const hashedVerificationCode = crypto
    .createHash("sha256")
    .update(verificationCode)
    .digest("hex");

  //update user with new email code and expiration time
  await User.updateOne(
    { email },
    {
      emailVerificationCode: hashedVerificationCode,
      emailVerificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes from now
    }
  );

  const htmlEmail = `
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
            Account Verification Code
        </div>
        <div class="email-content">
            <p>Hello, ${user.name}</p>
            <p>We received a request to verify your email on your ${process.env.EMAIL_FROM} Account.
     </p>
            <div class="verification-code">
                ${verificationCode}
            </div>
            <p>enter this code to complete the verification.\n
   </p>
        </div>
        <div class="email-footer">
            <p>Thanks for helping us keep your account secure.,<br>${process.env.EMAIL_FROM}</p>
        </div>
    </div>
</body>

</html>
  `;

  await sendEmail({
    to: user.email,
    subject: "Your Email Verification Code (valid for 10 minutes)",
    html: htmlEmail,
  });

  res.status(200).json({
    status: "success",
    message: `Email Verification Code Sent Successfully To ${user.email}`,
  });
});

//@desc  reset password
//@route PUT /api/v1/auth/resetPassword
//@access public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // 1-Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with that email ${req.body.email}`, 404)
    );
  }

  // 2- Check if reset code is verified
  if (!user.passwordResetVerified) {
    return next(new ApiError("Reset code not verified", 400));
  }

  const newPass = await bcrypt.hash(req.body.newPassword, 12);
  // 3- Update the user's password and clear reset code fields
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        password: newPass, // Update the password field
      },
      $unset: {
        passwordResetCode: "", // Remove passwordResetCode
        passwordResetExpires: "", // Remove passwordResetExpires
        passwordResetVerified: "", // Remove passwordResetVerified
      },
    },
    { new: true }
  );

  // 4- Generate token and send response
  const token = generateToken(user._id);
  res.status(200).json({ user, token });
});

// Get logged-in user's data
exports.getLoggedUserData = async (req, res, next) => {
  try {
    // 1- check if token exists, if exist get it
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return next(new ApiError("you are not login,please login first", 401));
    }
    //2- verify token (no change happens,expired token)
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // 3- Check if user exists
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return next(new ApiError("User no longer exists", 401));
    }
    //4-check if user changed password after token generated
    if (currentUser.passwordChangedAt) {
      //convert data to timestamp by =>getTime()
      const passwordChangedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10
      );
      //it mean password changer after token generated
      if (passwordChangedTimestamp > decoded.iat) {
        return next(
          new ApiError(
            "user recently changed his password,please login again",
            401
          )
        );
      }
    } //----------------------
    // Select specific fields for logged-in user
    const user = await User.findById(currentUser._id).select(
      "name email profileImg authToReview coverImg role timeSpent " +
        "isMarketer isInstructor isCustomerService startMarketing " +
        "idNumber phone country idVerification note lang"
    );

    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};

//@desc Google Mobile OAuth Authentication
//@route POST /api/v1/auth/google/mobile
//@access public
exports.googleMobileAuth = asyncHandler(async (idToken) => {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  try {
    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      throw new ApiError("Email not provided by Google", 400);
    }

    // Find existing user by Google ID or email
    let existingUser = await User.findOne({
      $or: [{ "google.id": googleId }, { email: email }],
    });

    if (existingUser) {
      // Check if the user has logged in with Google before
      if (!existingUser.google || !existingUser.google.id) {
        // The user exists by email but hasn't logged in with Google before
        await User.updateOne(
          { _id: existingUser._id },
          {
            $set: {
              "google.id": googleId,
              "google.email": email,
              isOAuthUser: true,
            },
          }
        );
        // Refresh the user object
        existingUser = await User.findById(existingUser._id);
      }

      // Generate JWT token
      const token = generateToken(existingUser._id);

      // Remove sensitive data
      const userResponse = existingUser.toObject();
      delete userResponse.password;
      delete userResponse.idDocuments;

      return { user: userResponse, token };
    }

    // No user exists, create a new user
    const newUser = await User.create({
      name: name,
      email: email,
      google: {
        id: googleId,
        email: email,
      },
      isOAuthUser: true,
      emailVerified: true,
      active: true,
    });

    const token = generateToken(newUser._id);

    // Remove sensitive data
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.idDocuments;

    return { user: userResponse, token };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Invalid Google token or authentication failed", 401);
  }
});

//------------------------------------
exports.checkIfUserIsAdminOrInstructor = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }
  if (!req.user.isInstructor) {
    return next(
      new ApiError("You are not authorized to access this route", 404)
    );
  }
  return next();
};
