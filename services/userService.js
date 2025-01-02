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
const MarketLog = require('../models/MarketingModel');
const UserSubscription = require('../models/userSubscriptionModel');

//upload user images
exports.uploadImages = uploadMixOfFiles([
  {
    name: 'profileImg',
    maxCount: 1,
  },
  {
    name: 'coverImg',
    maxCount: 1,
  },
  {
    name: 'idDocuments',
    maxCount: 3,
  },
]);

// Image processing
exports.resizeImage = async (req, res, next) => {
  // Check if req.files is present; if not, proceed to the next middleware
  if (!req.files) {
    return next();
  }

  // Helper function to process and resize a single image
  const processImage = async (file, folderName, fieldName, isArray = false) => {
    if (file && file.mimetype.startsWith('image/')) {
      const newFileName = `${fieldName}-${uuidv4()}-${Date.now()}.webp`;

      await sharp(file.buffer)
        .toFormat('webp')
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
    '',
    'profileImg',
  );

  // Process cover image
  await processImage(
    req.files.coverImg ? req.files.coverImg[0] : null,
    '',
    'coverImg',
  );

  // Process each ID document image if present
  if (req.files.idDocuments) {
    // eslint-disable-next-line no-restricted-syntax
    for (const file of req.files.idDocuments) {
      // eslint-disable-next-line no-await-in-loop
      await processImage(file, 'idDocuments', 'idDocuments', true);
    }
  }

  next();
};

//filter to get all user (isInstructor:true or role:admin)
exports.createFilterObjToGetInstructors = async (req, res, next) => {
  const filterObject = { $or: [{ isInstructor: true }, { role: 'admin' }] };

  req.filterObj = filterObject;
  next();
};

//get all users tha have not this course and filter them by users that have orders and users that have not orders
exports.getUsersWithoutCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new Error('Invalid course ID');
    }

    const usersByOrderStatus = await User.aggregate([
      {
        $match: {
          role: { $nin: ['admin', 'campaign'] },
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'userOrders',
        },
      },
      {
        $facet: {
          // Type 1: Users who have orders but not the specific course
          purchasers: [
            { $match: { 'userOrders.0': { $exists: true } } }, // Match users with at least one order
            {
              $match: {
                'userOrders.course': {
                  $ne: new mongoose.Types.ObjectId(courseId),
                },
              },
            }, // Match users who did not purchase the specific course
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                orderCount: { $size: '$userOrders' }, // Optional: to see number of orders
                // Add other user fields as needed
              },
            },
          ],
          // Type 2: Users who have no orders and did not buy the specific course
          nonPurchasers: [
            { $match: { 'userOrders.0': { $exists: false } } }, // Match users without orders
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                profileImg: 1,
                // Add other user fields as needed
              },
            },
          ],
        },
      },
    ]);

    // Access the results for each type:
    const { purchasers } = usersByOrderStatus[0]; // Type 1: Users who have orders but not the course
    const { nonPurchasers } = usersByOrderStatus[0]; // Type 2: Users who have no orders

    res.status(200).json({
      success: true,
      purchasers,
      nonPurchasers,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};

//get all users tha have not this course and filter them by users that have orders and users that have not orders
exports.getUsersCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const usersWhoOrderedSpecificCourse = await User.aggregate([
      {
        $match: {
          role: { $nin: ['admin', 'campaign'] },
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'userOrders',
        },
      },
      {
        $match: {
          'userOrders.course': new mongoose.Types.ObjectId(courseId), // Match users who ordered the specific course
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          profileImg: 1,
          // Add other user fields as needed
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: usersWhoOrderedSpecificCourse,
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
          role: { $nin: ['admin', 'campaign'] },
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'userOrders',
        },
      },
      {
        $facet: {
          // Users who have orders
          purchasers: [
            { $match: { 'userOrders.0': { $exists: true } } }, // Match users with at least one order
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                orderCount: { $size: '$userOrders' }, // Optional: to show the number of orders
                // Add other user fields as needed
              },
            },
          ],
          // Users who have no orders
          nonPurchasers: [
            { $match: { 'userOrders.0': { $exists: false } } }, // Match users without orders
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
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

    // // //send email to all users without orders
    // try {
    //   const emailPromises = usersWithoutOrders.map(async (user) => {
    //     const htmlEmail = `
    //     <h1>Hi ${user.name},</h1>
    //     <p>It seems you haven't placed any orders yet. Don't miss out on our amazing courses and packages. Visit our website to explore more.</p>
    //     <p>Best regards,</p>
    //     <p>NEXGEN Team</p>
    //     `;
    //     await sendEmail({
    //       to: user.email,
    //       subject: "Don't miss out on our amazing courses and packages!",
    //       html: htmlEmail,
    //     });
    //   });

    //   await Promise.all(emailPromises); // Wait for all email sending operations to complete

    return res.status(200).json({
      success: true,
      purchasers,
      nonPurchasers,
    });
    // } catch (err) {
    //   return next(
    //     new ApiError(`There is a problem with sending emails ${err}`, 500)
    //   );
    // }
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
};
//@desc get list of user
//@route GET /api/v1/users
//@access private
exports.getUsers = factory.getALl(User, 'User');
//@desc get specific User by id
//@route GET /api/v1/User/:id
//@access public
exports.getUser = async (req, res, next) => {
  try {
    let user = {};
    if (req.user.role === 'admin') {
      user = await User.findById(req.params.id);
    } else {
      user = await User.findById(req.params.id).select(
        'name email profileImg authToReview coverImg role timeSpent isMarketer isInstructor isCustomerService startMarketing idNumber phone country idVerification note',
      );
    }
    if (!user) {
      return next(
        new ApiError(`No document found with this id ${req.params.id}`, 404),
      );
    }
    res.status(200).json({ data: user });
  } catch (err) {
    next(new ApiError(err.message, 400));
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
    },
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
          new ApiError(`User not found for this id ${req.params.id}`, 404),
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
          { 'participants.user': user._id, isGroupChat: true },
          { $pull: { participants: { user: user._id } } },
        ).session(session),
        // Delete direct chats
        Chat.deleteMany({
          'participants.user': user._id,
          isGroupChat: false,
        }).session(session),
      ]);

      // Return success response
      res.status(204).send();
    })
    .catch((error) => {
      // Handle any transaction-related errors
      console.error('Transaction error:', error);
      return next(new ApiError('Error during transaction', 500));
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
    },
  );
  //generate token
  const token = generateToken(req.user._id);

  res.status(200).json({ data: user, token });
};
//@desc update logged user data without updating password or role
//@route PUT /api/v1/user/changeMyData
//@access private/protect
exports.updateLoggedUserData = async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      phone: req.body.phone,
      profileImg: req.body.profileImg,
      coverImg: req.body.coverImg,
      bio: req.body.bio,
    },
    {
      new: true,
    },
  );
  res.status(200).json({ data: user });
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
  res.status(201).json({ data: 'success' });
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
    },
  );
  return true;
};
//@desc get specific User by filter and  select fields if exist and populate
//@route null
//@access internal
exports.getUserAsDoc = async (filter, selectFields = '', populate = '') => {
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
    return next(new ApiError('No user found', 404));
  }

  // get user course progress
  const courseProgress = await CourseProgress.find({
    user: req.params.id,
  }).populate({
    path: 'course',
    select: 'title -category -accessibleCourses ',
  });

  //get all courses from course progress
  const courses = courseProgress.map((progress) => progress.course);
  data.courses = courses;
  // get user subscriptions
  const userSubscriptions = await UserSubscription.find({
    user: req.params.id,
  });
  //get all packages from user subscriptions and startData and endData and exclude these fields -course -highlights

  const packages = userSubscriptions.map((subscription) => ({
    package: subscription.package.title,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  }));
  data.packages = packages;
  // get user orders
  const orders = await Order.find({ user: req.params.id });
  data.orders = orders;

  //send response
  res.status(200).json({
    status: 'success',
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
      return next(new ApiError('You cannot follow yourself', 400));
    }

    // Check if the user to follow exists
    const userToFollow = await User.findById(userIdToFollow);
    if (!userToFollow) {
      return next(new ApiError('User not found', 404));
    }

    // Check if already following
    const alreadyFollowing = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: userIdToFollow } },
    });
    if (alreadyFollowing) {
      return next(new ApiError('You are already following this user', 400));
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
      type: 'follow',
      followedUser: req.user._id,
    });

    // Send response
    res.status(200).json({
      status: 'success',
      message: 'You followed this user',
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
      return next(new ApiError('You are not following this user', 400));
    }

    // Update the notification bell status to active (true)
    await User.updateOne(
      { _id: req.user._id, 'following.user': followedUserId },
      { $set: { 'following.$.notificationBell': true } },
    );

    res
      .status(200)
      .json({ success: true, message: 'Notification bell activated' });
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
      return next(new ApiError('You are not following this user', 400));
    }

    // Update the notification bell status to inactive (false)
    await User.updateOne(
      { _id: req.user._id, 'following.user': followedUserId },
      { $set: { 'following.$.notificationBell': false } },
    );

    res
      .status(200)
      .json({ success: true, message: 'Notification bell deactivated' });
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
      return next(new ApiError('You cannot unfollow yourself', 400));
    }

    // Check if the user to unfollow exists
    const userToUnfollow = await User.findById(userIdToUnfollow);
    if (!userToUnfollow) {
      return next(new ApiError('User not found', 404));
    }

    // Check if already not following
    const isFollowing = await User.findOne({
      _id: req.user._id,
      following: { $elemMatch: { user: userIdToUnfollow } },
    });
    if (!isFollowing) {
      return next(new ApiError('You are not following this user', 400));
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
      status: 'success',
      message: 'You unfollowed this user',
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
    .populate('followers', 'name email profileImg')
    .populate('following', 'name email profileImg');
  res.status(200).json({
    status: 'success',
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
    if (action !== 'verified' && action !== 'rejected') {
      return next(new ApiError('Invalid action', 400));
    }
    // Toggle approval status of ID document
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Toggle the `approveIdDocument` field in one step
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { idVerification: action, note, idNumber, name } },
      { new: true },
    );

    if (updatedUser && action === 'verified') {
      // Send a notification to the user
      await Notification.create({
        user: req.params.id,
        message: {
          ar: 'تهانينا! تمت الموافقة على وثائق الهوية الخاصة بك',
          en: 'Congratulations! Your ID documents have been approved',
        },
        type: 'system',
      });
    }
    if (updatedUser && action === 'rejected') {
      // Send a notification to the user
      await Notification.create({
        user: req.params.id,
        message: {
          ar: 'تم رفض الوثائق الخاصة بك يرجى تحميل وثيقة صالحة',
          en: 'Your ID documents have been rejected please upload a valid one',
        },
        type: 'system',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (err) {
    next(new ApiError(err.message, 400));
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
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return next(new ApiError('you are not login,please login first', 401));
    }
    //2- verify token (no change happens,expired token)
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // 3- Check if user exists
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return next(new ApiError('User no longer exists', 401));
    }
    //4-check if user changed password after token generated
    if (currentUser.passwordChangedAt) {
      //convert data to timestamp by =>getTime()
      const passwordChangedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10,
      );
      //it mean password changer after token generated
      if (passwordChangedTimestamp > decoded.iat) {
        return next(
          new ApiError(
            'user recently changed his password,please login again',
            401,
          ),
        );
      }
    }
    //5-check if user is active
    if (!currentUser.active) {
      return next(new ApiError('You Are Not Active', 401));
    }

    if (currentUser.idVerification === 'verified') {
      throw new ApiError('You have already verified your ID document', 400);
    }

    //  Validate documents
    if (
      !req.body.idDocuments ||
      !Array.isArray(req.body.idDocuments) ||
      req.body.idDocuments.length === 0
    ) {
      throw new ApiError('Please provide at least one ID document', 400);
    }

    // 5) Update user documents and set status to pending
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        idDocuments: req.body.idDocuments,
        idVerification: 'pending',
        note: null, // Reset any previous notes
      },
      { new: true },
    );

    res.status(200).json({
      status: 'success',
      message: 'ID documents uploaded successfully and pending verification',
      data: {
        idVerification: updatedUser.idVerification,
        idDocuments: updatedUser.idDocuments,
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
