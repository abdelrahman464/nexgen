const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../utils/apiError");
const factory = require("./handllerFactory");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const generateToken = require("../utils/generateToken");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");
const CourseProgress = require("../models/courseProgressModel");
const Message = require("../models/MessageModel");
const Chat = require("../models/ChatModel");
const Notification = require("../models/notificationModel");
const React = require("../models/reactionModel");
const Comment = require("../models/commentModel");
const Course = require("../models/courseModel");
const MarketLog = require("../models/MarketingModel");
const UserSubscription = require("../models/userSubscriptionModel");
const { moveOrdersFromOneToOne } = require("./marketing/marketingService");
const Article = require("../models/articalModel");
const Package = require("../models/packageModel");
const CoursePackage = require("../models/coursePackageModel");
const Live = require("../models/liveModel");

const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const generateToken = require('../utils/generateToken');
const { uploadMixOfFiles } = require('../middlewares/uploadImageMiddleware');
const CourseProgress = require('../models/courseProgressModel');
const Message = require('../models/MessageModel');
const Chat = require('../models/ChatModel');
const Notification = require('../models/notificationModel');
const React = require('../models/reactionModel');
const Comment = require('../models/commentModel');
const Course = require('../models/courseModel');
const MarketLog = require('../models/MarketingModel');
const UserSubscription = require('../models/userSubscriptionModel');
const { moveOrdersFromOneToOne } = require('./marketing/marketingService');
const Article = require('../models/articalModel');
const Package = require('../models/packageModel');
const CoursePackage = require('../models/coursePackageModel');
const Live = require('../models/liveModel');
const { verifyIdentityWithOpenAI } = require('./identityVerificationService');
>>>>>>> abdo-branch

//upload user images
exports.uploadImages = uploadMixOfFiles([
  {
    name: "profileImg",
    maxCount: 1,
  },
  {
    name: "coverImg",
    maxCount: 1,
  },
  {
    name: "signatureImage",
    maxCount: 1,
  },
  {
    name: "idDocuments",
    maxCount: 3,
  },
]);

// Image processing
exports.resizeImage = async (req, res, next) => {
  try {
    // Check if req.files is present; if not, proceed to the next middleware
    if (!req.files) {
      return next();
    }

    // Helper function to process and resize a single image
    const processImage = async (
      file,
      folderName,
      fieldName,
      isArray = false
    ) => {
      if (file && file.mimetype.startsWith("image/")) {
        const newFileName = `${fieldName}-${uuidv4()}-${Date.now()}.webp`;

        await sharp(file.buffer)
          .toFormat("webp")
          .webp({ quality: 95 })
          .toFile(`uploads/users/${folderName}/${newFileName}`);

        // Save the generated file name in the request body for database saving
        if (isArray) {
          if (!req.body[fieldName]) req.body[fieldName] = [];
          req.body[fieldName].push(newFileName);
        } else {
          req.body[fieldName] = newFileName;
        }
      } else if (file) {
        return next(new ApiError(`${fieldName} is not an image file`, 400));
      }
    };

    // Process profile image
    await processImage(
      req.files.profileImg ? req.files.profileImg[0] : null,
      "",
      "profileImg"
    );

    // Process signature image
    await processImage(
      req.files.signatureImage ? req.files.signatureImage[0] : null,
      "",
      "signatureImage"
    );

    // Process cover image
    await processImage(
      req.files.coverImg ? req.files.coverImg[0] : null,
      "",
      "coverImg"
    );

    // Process each ID document image if present
    if (req.files.idDocuments) {
      // eslint-disable-next-line no-restricted-syntax
      for (const file of req.files.idDocuments) {
        // eslint-disable-next-line no-await-in-loop
        await processImage(file, "idDocuments", "idDocuments", true);
      }
    }

    next();
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};

//filter to get all user (isInstructor:true or role:admin)
exports.createFilterObjToGetInstructors = async (req, res, next) => {
  const filterObject = { $or: [{ isInstructor: true }, { role: "admin" }] };

  req.filterObj = filterObject;
  next();
};

//get all users tha have not this course and filter them by users that have orders and users that have not orders
exports.getUsersWithoutCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new Error("Invalid course ID");
    }

    const usersByCourseProgress = await User.aggregate([
      {
        $match: {
          role: { $nin: ["admin", "campaign"] }, // Exclude admins & campaign users
        },
      },
      {
        $lookup: {
          from: "courseprogresses", // Reference CourseProgress collection
          localField: "_id",
          foreignField: "user",
          as: "courseProgress",
        },
      },
      {
        $facet: {
          // Users who have CourseProgress but not for the specific course
          purchasers: [
            { $match: { "courseProgress.0": { $exists: true } } }, // Users with at least one course progress
            {
              $match: {
                "courseProgress.course": {
                  $ne: new mongoose.Types.ObjectId(courseId),
                }, // Users without the specific course
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                country: 1,
                profileImg: {
                  $cond: {
                    if: {
                      $and: [
                        { $ifNull: ["$profileImg", false] },
                        { $ne: ["$profileImg", ""] },
                      ],
                    }, // Check if profileImg exists and is not empty
                    then: {
                      $concat: [process.env.BASE_URL, "/users/", "$profileImg"],
                    }, // Append BASE_URL
                    else: null, // Set to null if missing or empty
                  },
                },
              },
            },
          ],
          // Users who have no CourseProgress at all
          nonPurchasers: [
            { $match: { "courseProgress.0": { $exists: false } } }, // Users with no course progress
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                country: 1,
                profileImg: {
                  $cond: {
                    if: {
                      $and: [
                        { $ifNull: ["$profileImg", false] },
                        { $ne: ["$profileImg", ""] },
                      ],
                    }, // Check if profileImg exists and is not empty
                    then: {
                      $concat: [process.env.BASE_URL, "/users/", "$profileImg"],
                    }, // Append BASE_URL
                    else: null, // Set to null if missing or empty
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    // Extract results from aggregation
    const { purchasers, nonPurchasers } = usersByCourseProgress[0];

    res.status(200).json({
      success: true,
      length: {
        purchasers: purchasers.length,
        nonPurchasers: nonPurchasers.length,
      },
      purchasers, // Users with course progress but NOT for this course
      nonPurchasers, // Users with NO course progress at all
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};

//get all users tha have not this course and filter them by users that have orders and users that have not orders
exports.getUsersCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const usersWhoHaveCourseProgress = await User.aggregate([
      {
        $match: {
          role: { $nin: ["admin", "campaign"] }, // Exclude admins & campaign users
        },
      },
      {
        $lookup: {
          from: "courseprogresses", // Reference the CourseProgress collection
          localField: "_id",
          foreignField: "user",
          as: "courseProgress",
        },
      },
      {
        $match: {
          "courseProgress.course": new mongoose.Types.ObjectId(courseId), // Ensure the course exists in CourseProgress
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          country: 1,
          profileImg: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ["$profileImg", false] },
                  { $ne: ["$profileImg", ""] },
                ],
              }, // Ensure profileImg exists
              then: {
                $concat: [process.env.BASE_URL, "/users/", "$profileImg"], // Ensure correct path
              },
              else: null, // Set to null if missing
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      length: usersWhoHaveCourseProgress.length,
      data: usersWhoHaveCourseProgress,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};

// get users without orders

exports.getPurchasersUsersAndNon = async (req, res, next) => {
  try {
    const usersWithAndWithoutOrders = await User.aggregate([
      {
        $match: {
          role: { $nin: ["admin", "campaign"] },
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "userOrders",
        },
      },
      {
        $facet: {
          // Users who have orders
          purchasers: [
            { $match: { "userOrders.0": { $exists: true } } }, // Match users with at least one order
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                country: 1,
                orderCount: { $size: "$userOrders" }, // Optional: to show the number of orders
                // Add other user fields as needed
              },
            },
          ],
          // Users who have no orders
          nonPurchasers: [
            { $match: { "userOrders.0": { $exists: false } } }, // Match users without orders
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                country: 1,
                profileImg: 1,
                // Add other user fields as needed
              },
            },
          ],
        },
      },
    ]);

    // Access both categories of users
    const { purchasers } = usersWithAndWithoutOrders[0]; // Users who have orders
    const { nonPurchasers } = usersWithAndWithoutOrders[0]; // Users who have no orders

    // Add baseURL to profile images
    const baseURL = process.env.BASE_URL;
    const processedPurchasers = purchasers.map((user) => ({
      ...user,
      profileImg: user.profileImg
        ? `${baseURL}/users/${user.profileImg}`
        : null,
    }));
    const processedNonPurchasers = nonPurchasers.map((user) => ({
      ...user,
      profileImg: user.profileImg
        ? `${baseURL}/users/${user.profileImg}`
        : null,
    }));

    return res.status(200).json({
      success: true,
      length: {
        purchasers: purchasers.length,
        nonPurchasers: nonPurchasers.length,
      },
      purchasers: processedPurchasers,
      nonPurchasers: processedNonPurchasers,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
//@desc get list of user
//@route GET /api/v1/users
//@access private

exports.getUsers = factory.getALl(User, "User");
//@desc get specific User by id
//@route GET /api/v1/User/:id
//@access public
exports.getUser = async (req, res, next) => {
  try {
    //1- check if token exists, if exist get it
    // let token;
    // if (
    //   req.headers.authorization &&
    //   req.headers.authorization.startsWith('Bearer')
    // ) {
    //   token = req.headers.authorization.split(' ')[1];
    // }
    // if (!token) {
    //   return next(new ApiError('you are not login,please login first', 401));
    // }
    // //2- verify token (no change happens,expired token)
    // const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // 3- Check if user exists
    // const currentUser = await User.findById(decoded.userId);
    // if (!currentUser) {
    //   return next(new ApiError('User no longer exists', 401));
    // }
    // //4-check if user changed password after token generated
    // if (currentUser.passwordChangedAt) {
    //   //convert data to timestamp by =>getTime()
    //   const passwordChangedTimestamp = parseInt(
    //     currentUser.passwordChangedAt.getTime() / 1000,
    //     10,
    //   );
    //   //it mean password changer after token generated
    //   if (passwordChangedTimestamp > decoded.iat) {
    //     return next(
    //       new ApiError(
    //         'user recently changed his password,please login again',
    //         401,
    //       ),
    //     );
    //   }
    // } //----------------------
    let user = {};
    if (req.user.role === "admin") {
      user = await User.findById(req.params.id);
    } else {
      user = await User.findById(req.params.id).select(
        "name email profileImg authToReview bio coverImg role timeSpent isMarketer isInstructor isCustomerService startMarketing idNumber phone country idVerification note signatureImage"
      );
    }
    if (!user) {
      return next(new ApiError("No user found", 404));
    }
    res.status(200).json({ data: user });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};

//@desc create user
//@route POST /api/v1/users
//@access private
exports.createUser = factory.createOne(User);
//@desc update specific user
//@route PUT /api/v1/user/:id
//@access private
exports.updateUser = factory.updateOne(User);

exports.changeUserPassword = async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );
  if (!user) {
    return next(new ApiError(`No document For this id ${req.params.id}`, 404));
  }
  res.status(200).json({ data: user });
};
//@desc delete User
//@route DELETE /api/v1/user/:id
//@access private
exports.deleteUser = async (req, res, next) => {
  await mongoose.connection
    .transaction(async (session) => {
      // Find and delete the user
      const user = await User.findByIdAndDelete(req.params.id).session(session);

      // Check if user exists
      if (!user) {
        return next(
          new ApiError(`User not found for this id ${req.params.id}`, 404)
        );
      }

      // Perform necessary deletions
      await Promise.all([
        Order.deleteMany({ user: user._id }).session(session),
        Message.deleteMany({ sender: user._id }).session(session),
        Notification.deleteMany({ user: user._id }).session(session),
        React.deleteMany({ user: user._id }).session(session),
        Comment.deleteMany({ user: user._id }).session(session),
        CourseProgress.deleteMany({ user: user._id }).session(session),
        MarketLog.deleteOne({ marketer: user._id }).session(session),
        // Remove user from group chats
        Chat.updateMany(
          { "participants.user": user._id, isGroupChat: true },
          { $pull: { participants: { user: user._id } } }
        ).session(session),
        // Delete direct chats
        Chat.deleteMany({
          "participants.user": user._id,
          isGroupChat: false,
        }).session(session),
      ]);

      // Return success response
      res.status(204).send();
    })
    .catch((error) => {
      // Handle any transaction-related errors
      console.error("Transaction error:", error);
      return next(new ApiError("Error during transaction", 500));
    });
};

//@desc get logged user data
//@route GET /api/v1/user/getMe
//@access private/protect
exports.getLoggedUserData = async (req, res, next) => {
  // i will set the req,params.id because i will go to the next middleware =>>> (getUser)
  req.params.id = req.user._id;
  next();
};
//@desc update logged user password
//@route PUT /api/v1/user/changeMyPassword
//@access private/protect
exports.updateLoggedUserPassword = async (req, res, next) => {
  //update user password passed on user payload (req.user._id)
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );
  //generate token
  const token = generateToken(req.user._id);

  res.status(200).json({ data: user, token });
};
//@desc update logged user data without updating password or role
//@route PUT /api/v1/user/changeMyData
//@access private/protect
exports.updateLoggedUserData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update only if country or phone is not set in the database
    const updateData = {
      profileImg: req.body.profileImg,
      coverImg: req.body.coverImg,
      signatureImage: req.body.signatureImage,
      bio: req.body.bio,
      lang: req.body.lang,
    };

    if (!user.country && req.body.country) {
      updateData.country = req.body.country;
    }

    if (!user.phone && req.body.phone) {
      updateData.phone = req.body.phone;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
    });

    res.status(200).json({ data: updatedUser });
  } catch (error) {
    next(error);
  }
};

//@desc deactivate logged user
//@route DELETE /api/v1/user/active/:id
//@access protect
exports.unActiveUser = async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { active: false });
  res.status(204).send();
};
//@desc activate logged user
//@route PUT /api/v1/user/active/:id
//@access protect
exports.activeUser = async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { active: true });
  res.status(201).json({ data: "success" });
};
//---------
//@desc avail user to review
//@route: no route
//@access : internal (event)
exports.availUserToReview = async (userId) => {
  await User.findByIdAndUpdate(
    { _id: userId, authToReview: false },
    {
      authToReview: true,
    }
  );
  return true;
};
//@desc get specific User by filter and  select fields if exist and populate
//@route null
//@access internal
exports.getUserAsDoc = async (filter, selectFields = "", populate = "") => {
  //1-initialize the query
  let query = User.findOne(filter);
  //2- check if selectFields
  if (selectFields) {
    query = query.select(selectFields);
  }
  //3- check populate exist
  if (populate) {
    query = query.populate(populate);
  }
  //4- execute the query
  const user = await query;

  return user;
};
//@desc get all course and packages and course packages and orders for specific user
//@route  users/:id/userData
//@access protected admin
exports.getUserData = async (req, res, next) => {
  const data = {};
  // get user data
  const user = await User.findById(req.params.id);
  // check if user exist
  if (!user) {
    return next(new ApiError("No user found", 404));
  }

  // get user course progress
  const courseProgress = await CourseProgress.find({
    user: req.params.id,
  }).populate({
    path: "course",
    select: "title -category -accessibleCourses ",
  });

  //get all courses from course progress
  let courses = courseProgress.map((progress) => progress.course);
  courses = Course.schema.methods.toJSONLocalizedOnly(courses, req.locale);

  data.courses = courses;
  // get user subscriptions
  const userSubscriptions = await UserSubscription.find({
    user: req.params.id,
  });
  //get all packages from user subscriptions and startData and endData and exclude these fields -course -highlights

  const packages = userSubscriptions.map((subscription) => ({
    package: subscription.package.title[req.locale],
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  }));
  // packages = Package.schema.methods.toJSONLocalizedOnly(packages, req.locale);
  data.packages = packages;
  // get user orders
  const orders = await Order.find({ user: req.params.id });
  data.orders = orders;

  //send response
  res.status(200).json({
    status: "success",
    data,
  });
};

//@desc follow user
//@route  users/follow/:id
//@access protected
exports.followUser = async (req, res, next) => {
  try {
    const userIdToFollow = req.params.id;

    // Check if the user is trying to follow themselves
    if (req.user._id.toString() === userIdToFollow.toString()) {
      return next(new ApiError("You cannot follow yourself", 400));
    }

    // Check if the user to follow exists
    const userToFollow = await User.findById(userIdToFollow);
    if (!userToFollow) {
      return next(new ApiError("User not found", 404));
    }

    // Check if already following
    const alreadyFollowing = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: userIdToFollow } },
    });
    if (alreadyFollowing) {
      return next(new ApiError("You are already following this user", 400));
    }

    // Update the following list of the logged-in user
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: {
        following: {
          user: userIdToFollow,
          notificationBell: false, // Default to false when following
        },
      },
    });

    // Update the followers list of the user being followed
    await User.findByIdAndUpdate(userIdToFollow, {
      $addToSet: { followers: req.user._id },
    });

    // Send a notification to the followed user
    await Notification.create({
      user: userIdToFollow,
      message: {
        ar: ` ${req.user.name} قام بمتابعتك`,
        en: `${req.user.name} followed you`,
      },
      type: "follow",
      followedUser: req.user._id,
    });

    // Send response
    res.status(200).json({
      status: "success",
      message: "You followed this user",
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
//@desc  Activate notification bell for a followed user
//@route POST users/notificationBell/:id
//@access protected
exports.activeNotificationBell = async (req, res, next) => {
  try {
    const followedUserId = req.params.id;

    // Check if the current user is following the target user
    const user = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: followedUserId } },
    });

    if (!user) {
      return next(new ApiError("You are not following this user", 400));
    }

    // Update the notification bell status to active (true)
    await User.updateOne(
      { _id: req.user._id, "following.user": followedUserId },
      { $set: { "following.$.notificationBell": true } }
    );

    res
      .status(200)
      .json({ success: true, message: "Notification bell activated" });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
//@desc Deactivate notification bell for a followed user
//@route DELETE users/notificationBell/:id
//@access protected
exports.deActiveNotificationBell = async (req, res, next) => {
  try {
    const followedUserId = req.params.id;

    // Check if the current user is following the target user
    const user = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: followedUserId } },
    });

    if (!user) {
      return next(new ApiError("You are not following this user", 400));
    }

    // Update the notification bell status to inactive (false)
    await User.updateOne(
      { _id: req.user._id, "following.user": followedUserId },
      { $set: { "following.$.notificationBell": false } }
    );

    res
      .status(200)
      .json({ success: true, message: "Notification bell deactivated" });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
//@desc unFollowUser user
//@route  DELETE users/follow/:id
//@access protected
exports.unFollowUser = async (req, res, next) => {
  try {
    const userIdToUnfollow = req.params.id;

    // Check if the user is trying to unfollow themselves
    if (req.user._id.toString() === userIdToUnfollow.toString()) {
      return next(new ApiError("You cannot unfollow yourself", 400));
    }

    // Check if the user to unfollow exists
    const userToUnfollow = await User.findById(userIdToUnfollow);
    if (!userToUnfollow) {
      return next(new ApiError("User not found", 404));
    }

    // Check if already not following
    const isFollowing = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: userIdToUnfollow } },
    });
    if (!isFollowing) {
      return next(new ApiError("You are not following this user", 400));
    }

    // Update the following list of the logged-in user
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { following: { user: userIdToUnfollow } },
    });

    // Update the followers list of the user being unfollowed
    await User.findByIdAndUpdate(userIdToUnfollow, {
      $pull: { followers: req.user._id },
    });

    // Send response
    res.status(200).json({
      status: "success",
      message: "You unfollowed this user",
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};

//@desc get my followers and following
//@route  users/follow
//@access protected
exports.getMyFollowersAndFollowing = async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate("followers", "name email profileImg")
    .populate("following", "name email profileImg");
  res.status(200).json({
    status: "success",
    data: {
      followers: user.followers,
      following: user.following,
    },
  });
};
//@desc toggle approve id
//@route PUT /api/v1/users/idDocument/:id/:action
//@access private admin
exports.actionOnIdDocument = async (req, res, next) => {
  try {
    const { action, note, idNumber, name } = req.body;
    if (action === "verified") {
      if (!idNumber || !name) {
        return next(new ApiError("Please provide idNumber and name", 400));
      }
    }
    // Toggle approval status of ID document
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    // Toggle the `approveIdDocument` field in one step
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { idVerification: action, note, idNumber, name } },
      { new: true }
    );

    if (updatedUser && action === "verified") {
      // Send a notification to the user
      await Notification.create({
        user: req.params.id,
        message: {
          ar: "تهانينا! تمت الموافقة على وثائق الهوية الخاصة بك",
          en: "Congratulations! Your ID documents have been approved",
        },
        type: "system",
      });
    }
    if (updatedUser && action === "rejected") {
      // Send a notification to the user
      await Notification.create({
        user: req.params.id,
        message: {
          ar: "تم رفض الوثائق الخاصة بك يرجى تحميل وثيقة صالحة",
          en: "Your ID documents have been rejected please upload a valid one",
        },
        type: "system",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        user: updatedUser,
      },
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
/**
 * Verify user identity using OpenAI and return update data
 * @param {string} userId - User ID
 * @param {string[]} idDocuments - Array of ID document file paths
 * @param {Object} userData - User data (name, idNumber)
 * @returns {Object} Update data and verification result
 */
const verifyUserIdentity = async (userId, idDocuments, userData) => {
  try {
    // Check if OpenAI is configured
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === 'your-openai-api-key-here'
    ) {
      return {
        updateData: null,
        verificationResult: null,
        shouldVerify: false,
      };
    }

    // Verify identity using OpenAI
    const verificationResult = await verifyIdentityWithOpenAI(
      idDocuments,
      userData,
    );

    // Prepare update data based on verification result
    const updateData = {
      note: null,
    };

    let aiVerificationResult = null;

    // Check if extracted ID number already exists for another user
    let idNumberExists = false;
    if (verificationResult.verification.extractedIdNumber) {
      // Normalize the extracted ID number (remove spaces, dashes)
      const normalizedExtractedId =
        verificationResult.verification.extractedIdNumber
          .toString()
          .replace(/[\s-]/g, '');

      // Find all users with ID numbers and check if any match (normalized)
      const usersWithIdNumbers = await User.find({
        _id: { $ne: userId }, // Exclude current user
        idNumber: { $exists: true, $ne: null, $nin: ['', null] }, // Make sure idNumber exists and is not empty
      }).select('idNumber');

      // Check if any normalized ID number matches using array methods
      idNumberExists = usersWithIdNumbers.some((user) => {
        if (user.idNumber) {
          const normalizedExistingId = user.idNumber
            .toString()
            .replace(/[\s-]/g, '');
          return normalizedExistingId === normalizedExtractedId;
        }
        return false;
      });

      if (idNumberExists) {
        // Add this issue to the verification result
        if (!verificationResult.verification.issues) {
          verificationResult.verification.issues = [];
        }
        verificationResult.verification.issues.push(
          'ID number already exists for another user',
        );
        verificationResult.verification.verificationStatus = 'rejected';
        verificationResult.verification.isAuthentic = false;
      }
    }

    if (verificationResult.verification.verificationStatus === 'verified') {
      // Double-check ID number uniqueness even if AI verified
      if (idNumberExists) {
        updateData.idVerification = 'rejected';
        updateData.note = 'Rejected: ID number already exists for another user';
        aiVerificationResult = {
          status: 'rejected',
          message: 'ID number already exists for another user',
          issues: ['ID number already exists for another user'],
        };
      } else {
        updateData.idVerification = 'verified';
        updateData.note = 'Identity verified automatically using AI';

        // Update extracted data if available
        if (verificationResult.verification.extractedIdNumber) {
          updateData.idNumber =
            verificationResult.verification.extractedIdNumber;
        }
        if (verificationResult.verification.extractedName) {
          updateData.name = verificationResult.verification.extractedName;
        }

        aiVerificationResult = {
          status: 'verified',
          message: 'Identity verified automatically using AI',
          confidence: verificationResult.verification.confidence,
        };
      }
    } else if (
      verificationResult.verification.verificationStatus === 'rejected' ||
      idNumberExists
    ) {
      updateData.idVerification = 'rejected';
      updateData.note = `Rejected: ${verificationResult.verification.issues.join(', ')}`;

      aiVerificationResult = {
        status: 'rejected',
        message: updateData.note,
        issues: verificationResult.verification.issues,
      };
    } else {
      // Keep as pending for manual review
      updateData.idVerification = 'pending';
      updateData.note =
        verificationResult.verification.issues &&
        verificationResult.verification.issues.length > 0
          ? `Needs review: ${verificationResult.verification.issues.join(', ')}`
          : 'Needs manual review';

      // Don't update ID number if status is pending (wait for manual review)
      // Only update if we're confident
      if (
        verificationResult.verification.extractedIdNumber &&
        verificationResult.verification.confidence >= 80 &&
        !idNumberExists
      ) {
        // Normalize the extracted ID number
        const normalizedExtractedId =
          verificationResult.verification.extractedIdNumber
            .toString()
            .replace(/[\s-]/g, '');

        // Check again before updating even in pending status (with normalization)
        const usersWithIdNumbers = await User.find({
          _id: { $ne: userId },
          idNumber: { $exists: true, $ne: null, $nin: ['', null] }, // Make sure idNumber exists and is not empty
        }).select('idNumber');

        // Check if ID exists using array methods
        const idExistsInPending = usersWithIdNumbers.some((user) => {
          if (user.idNumber) {
            const normalizedExistingId = user.idNumber
              .toString()
              .replace(/[\s-]/g, '');
            return normalizedExistingId === normalizedExtractedId;
          }
          return false;
        });

        if (!idExistsInPending) {
          updateData.idNumber =
            verificationResult.verification.extractedIdNumber;
        } else {
          updateData.note += ' - ID number already exists';
          if (!verificationResult.verification.issues) {
            verificationResult.verification.issues = [];
          }
          verificationResult.verification.issues.push(
            'ID number already exists for another user',
          );
        }
      }

      aiVerificationResult = {
        status: 'pending',
        message: 'Needs manual review',
        confidence: verificationResult.verification.confidence,
      };
    }

    return {
      updateData,
      verificationResult: aiVerificationResult,
      shouldVerify: true,
      rawVerification: verificationResult,
    };
  } catch (error) {
    // Log error but don't fail - return pending status
    console.error('AI Verification Error:', error);
    return {
      updateData: {
        idVerification: 'pending',
        note: 'AI verification failed, will be reviewed manually',
      },
      verificationResult: {
        status: 'error',
        message: 'AI verification failed, will be reviewed manually',
        error: error.message,
      },
      shouldVerify: false,
    };
  }
};

//@desc verify identity using OpenAI
//@route POST /api/v1/users/idDocument/verify
//@access private
exports.verifyIdentityWithAI = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    if (!user.idDocuments || user.idDocuments.length === 0) {
      return next(new ApiError('No ID documents found for this user', 400));
    }

    // Verify identity using the separated function
    const verificationData = await verifyUserIdentity(
      userId,
      user.idDocuments,
      {
        name: user.name,
        idNumber: user.idNumber,
      },
    );

    if (!verificationData.shouldVerify) {
      const errorMessage =
        verificationData.verificationResult &&
        verificationData.verificationResult.message
          ? verificationData.verificationResult.message
          : 'OpenAI API key is not configured';
      return next(new ApiError(errorMessage, 400));
    }

    // Update user based on verification result
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      verificationData.updateData,
      { new: true },
    );

    // Send notification if verified
    if (updatedUser.idVerification === 'verified') {
      await Notification.create({
        user: userId,
        message: {
          ar: 'تهانينا! تم التحقق من هويتك تلقائياً',
          en: 'Congratulations! Your identity has been verified automatically',
        },
        type: 'system',
      });
    } else if (updatedUser.idVerification === 'rejected') {
      await Notification.create({
        user: userId,
        message: {
          ar: 'تم رفض الوثائق الخاصة بك يرجى تحميل وثيقة صالحة',
          en: 'Your ID documents have been rejected please upload a valid one',
        },
        type: 'system',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Identity verification completed',
      data: {
        user: updatedUser,
        verification: verificationData.rawVerification,
        verificationStatus: verificationData.updateData.idVerification,
      },
    });
  } catch (err) {
    next(new ApiError(err.message, err.statusCode || 500));
  }
};

//@desc upload idDocument
//@route POST /api/v1/users/idDocument/upload
//@access public
exports.uploadIdDocument = async (req, res, next) => {
  try {
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
    if (!currentUser.active) {
      return next(new ApiError("You Are Not Active", 401));
    }

    if (currentUser.idVerification === "verified") {
      throw new ApiError("You have already verified your ID document", 400);
    }

    //  Validate documents
    if (
      !req.body.idDocuments ||
      !Array.isArray(req.body.idDocuments) ||
      req.body.idDocuments.length === 0
    ) {
      throw new ApiError("Please provide at least one ID document", 400);
    }

    // 5) Update user documents and set status to pending initially
    const updateData = {
      idDocuments: req.body.idDocuments,
      idVerification: 'pending',
      note: null, // Reset any previous notes
    };

    // 6) Auto-verify using OpenAI if API key is configured
    const verificationData = await verifyUserIdentity(
      currentUser._id,
      req.body.idDocuments,
      {
        name: currentUser.name,
        idNumber: currentUser.idNumber,
      },
    );

    // Merge verification results into updateData if verification was performed
    if (verificationData.shouldVerify && verificationData.updateData) {
      Object.assign(updateData, verificationData.updateData);
    }

    // 7) Update user with final data (including AI verification results if available)
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
<<<<<<< HEAD
      {
        idDocuments: req.body.idDocuments,
        idVerification: "pending",
        note: null, // Reset any previous notes
      },
      { new: true }
=======
      updateData,
      { new: true },
>>>>>>> abdo-branch
    );

    // 8) Send notification if verified
    if (updatedUser.idVerification === 'verified') {
      await Notification.create({
        user: currentUser._id,
        message: {
          ar: 'تهانينا! تم التحقق من هويتك تلقائياً',
          en: 'Congratulations! Your identity has been verified automatically',
        },
        type: 'system',
      });
    } else if (updatedUser.idVerification === 'rejected') {
      await Notification.create({
        user: currentUser._id,
        message: {
          ar: 'تم رفض الوثائق الخاصة بك يرجى تحميل وثيقة صالحة',
          en: 'Your ID documents have been rejected please upload a valid one',
        },
        type: 'system',
      });
    }

    res.status(200).json({
<<<<<<< HEAD
      status: "success",
      message: "ID documents uploaded successfully and pending verification",
=======
      status: 'success',
      message: 'ID documents uploaded successfully',
>>>>>>> abdo-branch
      data: {
        idVerification: updatedUser.idVerification,
        idDocuments: updatedUser.idDocuments,
        note: updatedUser.note,
        aiVerification: verificationData.verificationResult,
      },
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
//------------------------------------
exports.getUsersByFilter = async (filter, fields) => {
  let users;
  if (fields) {
    users = await User.find(filter).select(fields);
  } else users = await User.find(filter);
  return users;
};

//@desc Register FCM token for push notifications
//@route POST /api/v1/users/fcm-token
//@access protected
exports.registerFcmToken = async (req, res, next) => {
  try {
    const { fcmToken, method } = req.body;

    if (!fcmToken) {
      return next(new ApiError("FCM token is required", 400));
    }
    let message = "";
    if (method === "register") {
      await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { fcmTokens: fcmToken } },
        { new: true }
      );
      message = "FCM token registered successfully";
    } else if (method === "unregister") {
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { fcmTokens: fcmToken } },
        { new: true }
      );
      message = "FCM token unregistered successfully";
    }
    res.status(200).json({
      status: "success",
      message: message,
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
//@desc Toggle push notifications on/off
//@route PUT /api/v1/users/push-notifications
//@access protected
exports.togglePushNotifications = async (req, res, next) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return next(new ApiError("enabled field must be a boolean", 400));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { pushNotificationsEnabled: enabled },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      message: `Push notifications ${enabled ? "enabled" : "disabled"}`,
      data: {
        pushNotificationsEnabled: user.pushNotificationsEnabled,
      },
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
//-----------------------------------------
exports.moveOneUserToAnother = async (req, res, next) => {
  const user = await User.findById(req.body.user);
  if (!user) {
    return next(new ApiError("No user found for this id", 404));
  }
  if (!user.invitor) {
    const invitorExistance = await User.exists({ _id: req.body.newInvitor });
    if (!invitorExistance) {
      return next(new ApiError("No invitor found for this id", 404));
    }
    user.invitor = req.body.newInvitor;
  } else {
    await moveOrdersFromOneToOne(user.invitor, req.body.newInvitor, user._id);
    user.invitor = req.body.newInvitor;
  }
  user.save();
  return res.status(200).json({ status: "success", msg: "mission done" });
};

//@desc get all courses ,,Blogs ,packages that his course related to instructor
//@route GET /api/v1/users/instructorBelongings/:id
//@access private instructor,admin

//@desc get all instructors with their belongings ordered by active courses first
//@route GET /api/v1/users/instructors-with-belongings
//@access private admin
exports.getAllInstructorsWithBelongings = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return next(
        new ApiError("You are not authorized to access this resource", 403)
      );
    }

    // Get all instructors
    const instructors = await User.find({ isInstructor: true }).select(
      "name email profileImg bio"
    );

    // Get belongings for each instructor and calculate active courses count
    const instructorsWithBelongings = await Promise.all(
      instructors.map(async (instructor) => {
        // Get courses for this instructor
        const courses = await Course.find({ instructor: instructor._id });

        // Count active courses
        const activeCoursesCount = courses.filter(
          (course) => course.status === "active"
        ).length;

        // Get packages related to instructor's courses
        const courseIds = courses.map((course) => course._id);
        const packages = await Package.find({ course: { $in: courseIds } });

        // Get course packages that contain instructor's courses
        const coursePackages = await CoursePackage.find({
          courses: { $in: courseIds },
        });

        // Get orders for instructor's courses
        const orders = await Order.find({ course: { $in: courseIds } });

        // Get articles by this instructor
        const articles = await Article.find({ author: instructor._id });

        // Get live sessions by this instructor
        const liveSessions = await Live.find({ instructor: instructor._id });

        return {
          instructor: {
            _id: instructor._id,
            name: instructor.name,
            email: instructor.email,
            profileImg: instructor.profileImg,
            bio: instructor.bio,
          },
          belongings: {
            courses: {
              total: courses.length,
              active: activeCoursesCount,
              inactive: courses.length - activeCoursesCount,
              list: courses,
            },
            packages: {
              total: packages.length,
              list: packages,
            },
            coursePackages: {
              total: coursePackages.length,
              list: coursePackages,
            },
            orders: {
              total: orders.length,
              list: orders,
            },
            articles: {
              total: articles.length,
              list: articles,
            },
            liveSessions: {
              total: liveSessions.length,
              list: liveSessions,
            },
          },
          activeCoursesCount, // For sorting
        };
      })
    );

    // Sort by active courses count (descending) - instructors with active courses come first
    instructorsWithBelongings.sort(
      (a, b) => b.activeCoursesCount - a.activeCoursesCount
    );

    // Remove the sorting field from final response
    const finalResponse = instructorsWithBelongings.map(
      ({ activeCoursesCount, ...rest }) => rest
    );

    res.status(200).json({
      status: "success",
      results: finalResponse.length,
      data: finalResponse,
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
  }
};
