const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const fs = require("fs");
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

exports.uploadFiles = uploadMixOfFiles([
  {
    name: "imageCover",
    maxCount: 1,
  },
  {
    name: "images",
    maxCount: 30,
  },
  {
    name: "documents",
    maxCount: 10,
  },
]);

exports.processFiles = asyncHandler(async (req, res, next) => {
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

  if (req.files.documents) {
    const documentProcessingPromises = req.files.documents.map(
      async (doc, index) => {
        const allowedMimeTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedMimeTypes.includes(doc.mimetype)) {
          return next(
            new ApiError(
              `File ${index + 1} is not a supported document type (PDF or Word).`,
              400
            )
          );
        }

        let fileExtension = ".doc";
        if (doc.mimetype === "application/pdf") {
          fileExtension = ".pdf";
        } else if (
          doc.mimetype.includes(
            "openxmlformats-officedocument.wordprocessingml.document"
          )
        ) {
          fileExtension = ".docx";
        }

        const documentName = `post-${uuidv4()}-${Date.now()}-${index + 1}${fileExtension}`;

        await new Promise((resolve, reject) => {
          fs.writeFile(`uploads/posts/${documentName}`, doc.buffer, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return documentName;
      }
    );

    try {
      const processedDocuments = await Promise.all(documentProcessingPromises);
      req.body.documents = processedDocuments;
    } catch (error) {
      return next(error);
    }
  }

  next();
});

//filter to get allowed posts for each user
exports.createFilterObjAllowedCoursePosts = asyncHandler(
  async (req, res, next) => {
    try {
      const { course } = req.params;
      if (!course) {
        return next(new ApiError("courseId is required", 400));
      }

      //if role is user
      if (req.user.role === "user") {
        const package = await Package.findOne({ course: course }).select(
          "_id course"
        );
        if (!package) {
          return next(new ApiError("No package found for this course", 404));
        }
        //-------------------------------------------------------------
        const userSubscription = await UserSubscription.findOne({
          user: req.user._id,
          package: package._id,
        }).select("_id package");

        if (!userSubscription) {
          const {
            course: {
              title: { en: courseTitle },
            },
          } = package;
          return next(
            new ApiError(
              `You are not subscribed to ${courseTitle} package`,
              404
            )
          );
        }
        if (userSubscription.endDate.getTime() < Date.now()) {
          const {
            course: {
              title: { en: courseTitle },
            },
          } = package;
          return next(
            new ApiError(
              `Your subscription to ${courseTitle} package has been expired`,
              404
            )
          );
        }
        //------------------------------------------------------------
      }
      req.filterObj = { sharedTo: "course", course: course };
      return next();
    } catch (error) {
      return next(
        new ApiError(
          `An error occurred while processing your request ${error.message}`,
          500
        )
      );
    }
  }
);
//-------------------------------------------------------
//filter to get analytics post  s only
exports.createFilterObjPackagesPosts = asyncHandler(async (req, res, next) => {
  try {
    const { package: packageId } = req.params;
    if (!packageId) {
      return next(new ApiError("packageId is required", 400));
    }
    const package = await Package.findById(packageId).select("_id course");
    if (!package) {
      return next(new ApiError("package not found", 404));
    }
    const {
      title: { en: packageTitle },
    } = package;

    if (req.user.role === "user") {
      const userSubscription = await UserSubscription.findOne({
        user: req.user._id,
        package: package._id,
      }).select("_id package endDate");

      if (!userSubscription) {
        return next(
          new ApiError(`You are not subscribed to ${packageTitle} package`, 404)
        );
      }
      if (userSubscription.endDate.getTime() < Date.now()) {
        return next(
          new ApiError(
            `Your subscription to ${packageTitle} package has been expired`,
            404
          )
        );
      }
    }

    req.filterObj = {
      sharedTo: "package",
      package: { $in: [package._id] },
    };
    return next();
  } catch (err) {
    return next(
      new ApiError(
        `An error occurred while processing your request ${err.message}`,
        500
      )
    );
  }
});
//-------------------------------------------------------------------------------------------------
//filter to get public posts only
exports.createFilterObjHomePosts = async (req, res, next) => {
  let filterObject;
  if (req.query.type) {
    if (req.query.type === "feed") {
      //1-get all profile posts
      filterObject = {
        sharedTo: "profile",
        user: mongoose.Types.ObjectId(req.query.user),
      };
    } else if (req.query.type === "following") {
      //1-get users he follow
      const user = await User.findById(req.user._id).select("following");
      //2-get usersIds from user.following
      const usersIds = user.following.map((object) =>
        mongoose.Types.ObjectId(object.user)
      );

      //3-filter posts to get posts of these users
      filterObject = {
        sharedTo: "profile",
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
  const { content, package, course, imageCover, images, sharedTo, documents } =
    req.body;

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
    documents,
  });

  // Populate the user field
  await post.populate("user", "name email");
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
  // Get the logged-in user's ID
  const loggedUserId = req.user._id;

  let filter = {};
  if (req.filterObj) {
    filter = req.filterObj;
  }

  // Extract pagination options from req.query
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const sort = req.query.sort ? JSON.parse(req.query.sort) : { createdAt: -1 }; // Default sort by creation date descending

  // Create an array to store additional match stages
  const additionalMatchStages = [];

  // Check for reaction type filtering
  if (req.query.reactionType) {
    additionalMatchStages.push({
      $match: {
        "reactions.type": req.query.reactionType,
      },
    });
  }

  // Check for minimum comments filtering
  if (req.query.minComments) {
    const minComments = parseInt(req.query.minComments, 10);
    additionalMatchStages.push({
      $match: {
        commentsCount: { $gte: minComments },
      },
    });
  }

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
        reactionTypes: {
          $reduce: {
            input: "$reactions",
            initialValue: [],
            in: {
              $cond: {
                if: { $in: ["$$this.type", "$$value"] },
                then: "$$value",
                else: { $concatArrays: ["$$value", ["$$this.type"]] },
              },
            },
          },
        },
        // Find the logged-in user's reaction
        loggedUserReaction: {
          $first: {
            $filter: {
              input: "$reactions",
              as: "reaction",
              cond: {
                $eq: ["$$reaction.user", mongoose.Types.ObjectId(loggedUserId)],
              },
            },
          },
        },
      },
    },
    {
      $project: {
        reactions: 0,
        comments: 0,
      },
    },
  ];

  // Add additional match stages
  aggregationStages.push(...additionalMatchStages);

  // Add remaining stages
  aggregationStages.push({ $sort: sort }, { $skip: skip }, { $limit: limit });

  // Check if course query parameter exists
  if (req.query.course) {
    const courseId = mongoose.Types.ObjectId(req.query.course);
    aggregationStages.unshift({
      $match: {
        $and: [filter, { course: courseId }],
      },
    });
  }

  // Check if package query parameter exists
  if (req.query.package) {
    const packageId = mongoose.Types.ObjectId(req.query.package);
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
    documents: post.documents.map((doc) => `${baseURL}/posts/${doc}`),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionsCount: post.reactionsCount,
    commentsCount: post.commentsCount,
    reactionTypes: post.reactionTypes,
    loggedUserReaction: post.loggedUserReaction
      ? {
          type: post.loggedUserReaction.type,
          _id: post.loggedUserReaction._id,
        }
      : null,
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
exports.getPost = asyncHandler(async (req, res, next) => {
  // Get the logged-in user's ID
  const loggedUserId = req.user._id;

  // Define the aggregation pipeline
  const aggregationStages = [
    // Match the specific post by ID
    {
      $match: {
        _id: mongoose.Types.ObjectId(req.params.id),
      },
    },
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
        reactionTypes: {
          $reduce: {
            input: "$reactions",
            initialValue: [],
            in: {
              $cond: {
                if: { $in: ["$$this.type", "$$value"] },
                then: "$$value",
                else: { $concatArrays: ["$$value", ["$$this.type"]] },
              },
            },
          },
        },
        // Find the logged-in user's reaction
        loggedUserReaction: {
          $first: {
            $filter: {
              input: "$reactions",
              as: "reaction",
              cond: {
                $eq: ["$$reaction.user", mongoose.Types.ObjectId(loggedUserId)],
              },
            },
          },
        },
      },
    },
    {
      $project: {
        reactions: 0,
        comments: 0,
      },
    },
  ];

  // Perform aggregation
  const posts = await Post.aggregate(aggregationStages);

  // Check if post exists
  if (!posts || posts.length === 0) {
    return next(new ApiError("No post found with that ID", 404));
  }

  // Prepare baseURL for image URLs
  const baseURL = process.env.BASE_URL;

  // Transform post data
  const post = {
    _id: posts[0]._id,
    user: {
      _id: posts[0].user._id,
      name: posts[0].user.name,
      profileImg: `${baseURL}/users/${posts[0].user.profileImg}`,
    },
    content: posts[0].content,
    sharedTo: posts[0].sharedTo,
    course: posts[0].course,
    package: posts[0].package,
    imageCover: posts[0].imageCover
      ? `${baseURL}/posts/${posts[0].imageCover}`
      : null,
    images: posts[0].images.map((image) => `${baseURL}/posts/${image}`),
    documents: posts[0].documents
      ? posts[0].documents.map((doc) => `${baseURL}/posts/${doc}`)
      : [],
    createdAt: posts[0].createdAt,
    updatedAt: posts[0].updatedAt,
    reactionsCount: posts[0].reactionsCount,
    commentsCount: posts[0].commentsCount,
    reactionTypes: posts[0].reactionTypes,
    loggedUserReaction: posts[0].loggedUserReaction
      ? {
          type: posts[0].loggedUserReaction.type,
          _id: posts[0].loggedUserReaction._id,
        }
      : null,
  };

  // Send response
  res.status(200).json({
    data: post,
  });
});
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
