const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../utils/apiError");
const Post = require("../models/postModel");
const Comment = require("../models/commentModel");
const Reaction = require("../models/reactionModel");
const Course = require("../models/courseModel");
const Package = require("../models/packageModel");
const UserSubscription = require("../models/userSubscriptionModel");
const User = require("../models/userModel");
const CourseProgress = require("../models/courseProgressModel");
const Notification = require("../models/notificationModel");
const factory = require("./handllerFactory");
const { uploadMixOfFiles } = require("../middlewares/uploadImageMiddleware");

exports.uploadImages = uploadMixOfFiles([
  {
    name: "imageCover",
    maxCount: 1,
  },
  {
    name: "images",
    maxCount: 30,
  },
]);

exports.resizeImages = asyncHandler(async (req, res, next) => {
  // Image processing for imageCover
  if (
    req.files.imageCover &&
    req.files.imageCover[0].mimetype.startsWith("image/")
  ) {
    const imageCoverFileName = `post-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.imageCover[0].buffer)
      .toFormat("webp") // Convert to WebP
      .webp({ quality: 95 })
      .toFile(`uploads/posts/${imageCoverFileName}`);

    // Save imageCover file name in the request body for database saving
    req.body.imageCover = imageCoverFileName;
  } else if (req.files.imageCover) {
    return next(new ApiError("Image cover is not an image file", 400));
  }

  // Image processing for images
  if (req.files.images) {
    const imageProcessingPromises = req.files.images.map(async (img, index) => {
      if (!img.mimetype.startsWith("image/")) {
        return next(
          new ApiError(`File ${index + 1} is not an image file.`, 400)
        );
      }

      const imageName = `post-${uuidv4()}-${Date.now()}-${index + 1}.webp`;

      await sharp(img.buffer)
        .toFormat("webp") // Convert to WebP
        .webp({ quality: 95 })
        .toFile(`uploads/posts/${imageName}`);

      return imageName;
    });

    try {
      const processedImages = await Promise.all(imageProcessingPromises);
      req.body.images = processedImages;
    } catch (error) {
      return next(error);
    }
  }

  next();
});

//filter to get allowed posts for each user
exports.createFilterObjAllowedCoursePosts = asyncHandler(
  async (req, res, next) => {
    let filterObject = {};

    //if role is user
    if (req.user.role === "user") {
      // all courses that the logged user is subscripe in

      //get all courses that user is subscribed in by getting all course progress that user have and extract the coursesIds from there
      const userCoursesProgress = await CourseProgress.find({
        user: req.user._id,
      });
      const coursesIds = userCoursesProgress.map((course) => course.course);

      filterObject = {
        sharedTo: "course",
        course: { $in: coursesIds },
      };
    }
    //if role is admin
    if (req.user.role === "admin") {
      filterObject = {
        sharedTo: "course",
      };
    }

    req.filterObj = filterObject;
    next();
  }
);
//-------------------------------------------------------------------------------------------------
//filter to get public posts only
exports.createFilterObjHomePosts = async (req, res, next) => {
  let filterObject = {};
  if (req.query.type) {
    if (req.query.type === "feed") {
      //1-get all profile posts
      filterObject = {
        sharedTo: "profile",
      };
    } else if (req.query.type === "following") {
      //1-get users he follow
      const user = await User.findById(req.user._id).select("following");
      //2-get usersIds from user.following
      const usersIds = user.following.map((object) => object.user);
      //3-filter posts to get posts of these users
      filterObject = {
        user: { $in: usersIds },
      };
    }
  } else {
    filterObject = {
      sharedTo: "home",
    };
  }
  req.filterObj = filterObject;
  next();
};
//filter to get analytics posts only
exports.createFilterObjPackagesPosts = asyncHandler(async (req, res, next) => {
  let filterObject = {};

  if (req.user.role === "user") {
    // all packages that suscripe in
    const userSubscriptions = await UserSubscription.find({
      user: req.user._id,
    });
    const packageIds = userSubscriptions.map((pack) => pack.package);

    filterObject = {
      sharedTo: "package",
      package: { $in: packageIds },
    };
  }
  if (req.user.role === "admin") {
    filterObject = {
      sharedTo: "package",
    };
  }
  req.filterObj = filterObject;
  next();
});
exports.convertToArray = (req, res, next) => {
  if (req.body.package) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.package)) {
      req.body.package = [req.body.package];
    }
  }
  if (req.body.course) {
    // If it's not an array, convert it to an array
    if (!Array.isArray(req.body.course)) {
      req.body.course = [req.body.course];
    }
  }
  next();
};
async function getUserFollowers(userId) {
  const followers = await User.find({
    following: {
      $elemMatch: {
        user: userId,
        notificationBell: true,
      },
    },
  });
  console.log(followers);
  if (followers.length === 0) return [];
  return followers.map((user) => user._id);
}
// Function to fetch users from package or course
async function fetchUsersFromTarget(target, ids) {
  const users = await Promise.all(
    ids.map(async (id) => {
      let targetModel;
      let usersInTarget;

      if (target === "package") {
        targetModel = Package;
        usersInTarget = await UserSubscription.find({
          package: id,
          endDate: { $gte: new Date() },
        });
      } else if (target === "course") {
        targetModel = Course;
        usersInTarget = await CourseProgress.find({ course: id });
      }

      const currentTarget = await targetModel.findById(id);
      if (!currentTarget) {
        throw new ApiError(`Target ${target} with ID ${id} not found`, 404);
      }

      return usersInTarget.map((user) => user.user);
    })
  );

  return users.flat();
}

//@desc create post
//@route POST api/v1/posts
//@access protected user
exports.createPost = asyncHandler(async (req, res, next) => {
  const { content, package, course, imageCover, images, sharedTo } = req.body;

  let users = [];
  if (sharedTo === "package") {
    if (!package || !Array.isArray(package) || package.length === 0) {
      return next(
        new ApiError("Package IDs must be provided as an array", 400)
      );
    }
    users = await fetchUsersFromTarget("package", package);
  } else if (sharedTo === "course") {
    if (!course || !Array.isArray(course) || course.length === 0) {
      return next(new ApiError("Course IDs must be provided as an array", 400));
    }
    users = await fetchUsersFromTarget("course", course);
  } else if (sharedTo === "profile") {
    //get users who follow this guy
    users = await getUserFollowers(req.user._id);
  }

  // Create a new post
  const post = await Post.create({
    user: req.user._id,
    content,
    package: sharedTo === "package" ? package : [],
    course: sharedTo === "course" ? course : [],
    imageCover,
    images,
    sharedTo,
  });

  // Create notifications for users
  if (users.length !== 0)
    await Promise.all(
      users.map(async (user) => {
        await Notification.create({
          user,
          message: {
            en: `${req.user.name} has shared a new post with you`,
            ar: `${req.user.name} قام بمشاركة منشور جديد معك`,
          },
          post: post._id,
          type: req.body.sharedTo === "profile" ? "follow" : "post",
        });
      })
    );

  res.status(201).json({ success: true, data: post });
});

//@desc update post
//@route PUT api/v1/posts/:id
//@access protected admin that create the post
exports.updatePost = factory.updateOne(Post);
//@desc get all posts post
//@route GET api/v1/posts/home
//@access protected user,admin

exports.getPosts = asyncHandler(async (req, res) => {
  let filter = {};
  if (req.filterObj) {
    filter = req.filterObj;
  }

  // Extract pagination options from req.query
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const sort = req.query.sort ? JSON.parse(req.query.sort) : { createdAt: -1 }; // Default sort by creation date descending

  // Define initial aggregation pipeline stages
  const aggregationStages = [
    { $match: filter },
    {
      $lookup: {
        from: "reactions",
        localField: "_id",
        foreignField: "post",
        as: "reactions",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "post",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $addFields: {
        reactionsCount: { $size: "$reactions" },
        commentsCount: { $size: "$comments" },
      },
    },
    {
      $project: {
        reactions: 0,
        comments: 0,
      },
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
  ];

  // Check if course query parameter exists
  if (req.query.course) {
    const courseId = mongoose.Types.ObjectId(req.query.course); // Convert course ID to ObjectId
    aggregationStages.unshift({
      $match: {
        $and: [filter, { course: courseId }],
      },
    });
  }
  // Check if package query parameter exists
  if (req.query.package) {
    const packageId = mongoose.Types.ObjectId(req.query.package); // Convert course ID to ObjectId
    aggregationStages.unshift({
      $match: {
        $and: [filter, { package: packageId }],
      },
    });
  }
  // Perform aggregation
  const postsWithCounts = await Post.aggregate(aggregationStages);

  // Prepare baseURL for image URLs
  const baseURL = process.env.BASE_URL;

  // Map posts to desired format
  const postsWithImages = postsWithCounts.map((post) => ({
    _id: post._id,
    user: {
      _id: post.user._id,
      name: post.user.name,
      profileImg: `${baseURL}/users/${post.user.profileImg}`,
    },
    content: post.content,
    sharedTo: post.sharedTo,
    course: post.course,
    package: post.package,
    imageCover: post.imageCover ? `${baseURL}/posts/${post.imageCover}` : null,
    images: post.images.map((image) => `${baseURL}/posts/${image}`),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionsCount: post.reactionsCount,
    commentsCount: post.commentsCount,
  }));

  // Count total documents without pagination
  const totalDocuments = await Post.countDocuments(filter);

  // Calculate pagination details
  const numberOfPages = Math.ceil(totalDocuments / limit);

  // Return response with results count, pagination, and data
  res.status(200).json({
    results: postsWithImages.length,
    paginationResult: {
      currentPage: page,
      limit: limit,
      numberOfPages: numberOfPages,
    },
    data: postsWithImages,
  });
});
//@desc get post
//@route GET api/v1/posts/:id
//@access protected user
exports.getPost = factory.getOne(Post);
//@desc delete post
//@route DELTE api/v1/posts:id
//@access protected admin that create the post
exports.deletePost = asyncHandler(async (req, res, next) => {
  try {
    await mongoose.connection.transaction(async (session) => {
      const { id } = req.params;
      // Find and delete the course
      const post = await Post.findByIdAndDelete(id).session(session);
      // Check if post exists
      if (!post) return next(new ApiError("post not found ", 404));

      // Delete associated lessons and reviews
      await Promise.all([
        Comment.deleteMany({ post: id }).session(session),
        Reaction.deleteMany({ post: id }).session(session),
      ]);
    });

    // Return success response
    res.status(204).send();
  } catch (error) {
    // Handle any transaction-related errors
    console.error("Transaction error:", error);
    if (error instanceof ApiError) {
      // Forward specific ApiError instances
      return next(error);
    }
    // Handle other errors with a generic message
    return next(new ApiError("Error during post deletion", 500));
  }
});
