const sharp = require('sharp');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const factory = require('./handllerFactory');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const generateToken = require('../utils/generateToken');
const { uploadSingleFile } = require('../middlewares/uploadImageMiddleware');
const CourseProgress = require('../models/courseProgressModel');
const Message = require('../models/MessageModel');
const Chat = require('../models/ChatModel');
const Notification = require('../models/notificationModel');
const React = require('../models/reactionModel');
const Comment = require('../models/commentModel');
const MarketLog = require('../models/MarketingModel');
const UserSubscription = require('../models/userSubscriptionModel');

//upload Single image
exports.uploadProfileImage = uploadSingleFile('profileImg');
//image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const { file } = req; // Access the uploaded file
  if (file) {
    const fileExtension = file.originalname.substring(
      file.originalname.lastIndexOf('.'),
    ); // Extract file extension
    const newFileName = `profileImg-${uuidv4()}-${Date.now()}${fileExtension}`; // Generate new file name

    // Check if the file is an image for the profile picture
    if (file.mimetype.startsWith('image/')) {
      // Process and save the image file using sharp for resizing, conversion, etc.
      const filePath = `uploads/users/${newFileName}`;

      await sharp(file.buffer)
        .toFormat('webp') // Convert to WebP
        .webp({ quality: 97 })
        .toFile(filePath);

      // Update the req.body to include the path for the new profile image
      req.body.profileImg = newFileName;
    } else {
      return next(
        new ApiError(
          'Unsupported file type. Only images are allowed for Profile Image.',
          400,
        ),
      );
    }
  }
  next();
});
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
//@access private
exports.getUser = factory.getOne(User);
//@desc create user
//@route POST /api/v1/users
//@access private
exports.createUser = factory.createOne(User);
//@desc update specific user
//@route PUT /api/v1/user/:id
//@access private
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      profileImg: req.body.profileImg,
      role: req.body.role,
      isInstructor: req.body.isInstructor,
    },
    {
      new: true,
    },
  );
  if (!user) {
    return next(new ApiError(`No document For this id ${req.params.id}`, 404));
  }

  res.status(200).json({ data: user });
});

exports.changeUserPassword = asyncHandler(async (req, res, next) => {
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
});
//@desc delete User
//@route DELETE /api/v1/user/:id
//@access private
exports.deleteUser = asyncHandler(async (req, res, next) => {
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
});

//@desc get logged user data
//@route GET /api/v1/user/getMe
//@access private/protect
exports.getLoggedUserData = asyncHandler(async (req, res, next) => {
  // i will set the req,pararms.id because i will go to the next middleware =>>> (getUser)
  req.params.id = req.user._id;
  next();
});
//@desc update logged user password
//@route PUT /api/v1/user/changeMyPassword
//@access private/protect
exports.updateLoggedUserPassword = asyncHandler(async (req, res, next) => {
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
  //genrate token
  const token = generateToken(req.user._id);

  res.status(200).json({ data: user, token });
});
//@desc update logged user data without updating password or role
//@route PUT /api/v1/user/changeMyData
//@access private/protect
exports.updateLoggedUserData = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      profileImg: req.body.profileImg,
    },
    {
      new: true,
    },
  );
  res.status(200).json({ data: user });
});
//@desc deactivate logged user
//@route DELETE /api/v1/user/active/:id
//@access protect
exports.unActiveUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { active: false });
  res.status(204).send();
});
//@desc activate logged user
//@route PUT /api/v1/user/active/:id
//@access protect
exports.activeUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { active: true });
  res.status(201).json({ data: 'success' });
});
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
  //5- check existance
  if (!user) {
    throw new Error('No user found');
  }
  return user;
};
//@desc get all course and packages and course packages and orders for specific user
//@route  users/:id/userData
//@access protected admin
exports.getUserData = asyncHandler(async (req, res, next) => {
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
});

//@desc get all user who does not have order
//@route  users/withoutOrders
//@access protected admin
