const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/apiError');
const Post = require('../models/postModel');
const Comment = require('../models/commentModel');
const Reaction = require('../models/reactionModel');
const Course = require('../models/courseModel');
const Package = require('../models/packageModel');
const UserSubscription = require('../models/userSubscriptionModel');
const User = require('../models/userModel');
const CourseProgress = require('../models/courseProgressModel');
const Notification = require('../models/notificationModel');
const factory = require('./handllerFactory');
const { uploadMixOfFiles } = require('../middlewares/uploadImageMiddleware');

exports.uploadFiles = uploadMixOfFiles([
  {
    name: 'imageCover',
    maxCount: 1,
  },
  {
    name: 'images',
    maxCount: 30,
  },
  {
    name: 'documents',
    maxCount: 10,
  },
]);

exports.processFiles = asyncHandler(async (req, res, next) => {
  // Image processing for imageCover
  if (
    req.files.imageCover &&
    req.files.imageCover[0].mimetype.startsWith('image/')
  ) {
    const imageCoverFileName = `post-${uuidv4()}-${Date.now()}-cover.webp`;

    await sharp(req.files.imageCover[0].buffer)
      .toFormat('webp') // Convert to WebP
      .webp({ quality: 95 })
      .toFile(`uploads/posts/${imageCoverFileName}`);

    // Save imageCover file name in the request body for database saving
    req.body.imageCover = imageCoverFileName;
  } else if (req.files.imageCover) {
    return next(new ApiError('Image cover is not an image file', 400));
  }

  // Image processing for images
  if (req.files.images) {
    const imageProcessingPromises = req.files.images.map(async (img, index) => {
      if (!img.mimetype.startsWith('image/')) {
        return next(
          new ApiError(`File ${index + 1} is not an image file.`, 400),
        );
      }

      const imageName = `post-${uuidv4()}-${Date.now()}-${index + 1}.webp`;

      await sharp(img.buffer)
        .toFormat('webp') // Convert to WebP
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
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!allowedMimeTypes.includes(doc.mimetype)) {
          return next(
            new ApiError(
              `File ${index + 1} is not a supported document type (PDF or Word).`,
              400,
            ),
          );
        }

        let fileExtension = '.doc';
        if (doc.mimetype === 'application/pdf') {
          fileExtension = '.pdf';
        } else if (
          doc.mimetype.includes(
            'openxmlformats-officedocument.wordprocessingml.document',
          )
        ) {
          fileExtension = '.docx';
        }

        const documentName = `post-${uuidv4()}-${Date.now()}-${index + 1}${fileExtension}`;

        await new Promise((resolve, reject) => {
          fs.writeFile(`uploads/posts/${documentName}`, doc.buffer, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return documentName;
      },
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
      //check is mongoose object id
      if (course && !mongoose.Types.ObjectId.isValid(course)) {
        return next(new ApiError('courseId is required', 400));
      }
      //if role is user
      if (req.user.role === 'user') {
        const package = await Package.findOne({ course: course }).select(
          '_id course',
        );
        if (!package) {
          return next(new ApiError('No package found for this course', 404));
        }
        //-------------------------------------------------------------

        const userSubscription = await UserSubscription.findOne({
          user: req.user._id,
          package: package._id,
        }).select('_id package endDate');

        if (!userSubscription) {
          //const courseTitle = package?.course?.title?.en || "this";
          const {
            course: {
              title: { en: courseTitle },
            },
          } = package;
          return next(
            new ApiError(
              `You are not subscribed to ${courseTitle} package`,
              404,
            ),
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
              404,
            ),
          );
        }
        //------------------------------------------------------------
      }
      req.filterObj = { sharedTo: 'course', course: { $in: [course] } };
      return next();
    } catch (error) {
      return next(
        new ApiError(
          `An error occurred while processing your request ${error.message}`,
          500,
        ),
      );
    }
  },
);
//-------------------------------------------------------
//filter to get analytics post  s only
exports.createFilterObjPackagesPosts = asyncHandler(async (req, res, next) => {
  try {
    const { package: packageId } = req.params;
    if (packageId && !mongoose.Types.ObjectId.isValid(packageId)) {
      return next(
        new ApiError('packageId is not a valid mongoose object id', 400),
      );
    }
    const package =
      await Package.findById(packageId).select('_id course title');
    if (!package) {
      return next(new ApiError('package not found', 404));
    }
    const {
      title: { en: packageTitle },
    } = package;

    if (req.user.role === 'user') {
      const userSubscription = await UserSubscription.findOne({
        user: req.user._id,
        package: package._id,
      }).select('_id package endDate');

      if (!userSubscription) {
        return next(
          new ApiError(
            `You are not subscribed to ${packageTitle} package`,
            404,
          ),
        );
      }

      if (userSubscription.endDate.getTime() < Date.now()) {
        return next(
          new ApiError(
            `Your subscription to ${packageTitle} package has been expired`,
            404,
          ),
        );
      }
    }

    req.filterObj = {
      sharedTo: 'package',
      package: { $in: [package._id] },
    };

    return next();
  } catch (err) {
    return next(
      new ApiError(
        `An error occurred while processing your request ${err.message}`,
        500,
      ),
    );
  }
});
//-------------------------------------------------------------------------------------------------
//filter to get public posts only
exports.createFilterObjHomePosts = async (req, res, next) => {
  let filterObject = {
    sharedTo: 'home',
  };

  if (req.query.type) {
    if (req.query.type === 'feed') {
      //1-get all profile posts
      filterObject = { sharedTo: 'profile' };
      if (req.query.user) {
        filterObject.user = mongoose.Types.ObjectId(req.query.user);
      }
    } else if (req.query.type === 'following') {
      //1-get users he follow
      const user = await User.findById(req.user._id).select('following');
      //2-get usersIds from user.following
      const usersIds = user.following.map((object) =>
        mongoose.Types.ObjectId(object.user),
      );

      //3-filter posts to get posts of these users
      filterObject = {
        sharedTo: 'profile',
        user: { $in: usersIds },
      };
    }
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

      if (target === 'package') {
        targetModel = Package;
        usersInTarget = await UserSubscription.find({
          package: id,
          endDate: { $gte: new Date() },
        });
      } else if (target === 'course') {
        targetModel = Course;
        usersInTarget = await CourseProgress.find({ course: id });
      }

      const currentTarget = await targetModel.findById(id);
      if (!currentTarget) {
        throw new ApiError(`Target ${target} with ID ${id} not found`, 404);
      }

      return usersInTarget.map((user) => user.user);
    }),
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
  if (sharedTo === 'package') {
    if (!package || !Array.isArray(package) || package.length === 0) {
      return next(
        new ApiError('Package IDs must be provided as an array', 400),
      );
    }
    users = await fetchUsersFromTarget('package', package);
  } else if (sharedTo === 'course') {
    if (!course || !Array.isArray(course) || course.length === 0) {
      return next(new ApiError('Course IDs must be provided as an array', 400));
    }
    users = await fetchUsersFromTarget('course', course);
  } else if (sharedTo === 'profile') {
    //get users who follow this guy
    users = await getUserFollowers(req.user._id);
  }

  // Create a new post
  const post = await Post.create({
    user: req.user._id,
    content,
    package: sharedTo === 'package' ? package : [],
    course: sharedTo === 'course' ? course : [],
    imageCover,
    images,
    sharedTo,
    documents,
  });

  // Populate the user field
  await post.populate('user', 'name email profileImg');
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
          type: req.body.sharedTo === 'profile' ? 'follow' : 'post',
        });
      }),
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
  const baseURL = process.env.BASE_URL;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const sort = req.query.sort ? JSON.parse(req.query.sort) : { createdAt: -1 };

  // Build a simple filter
  const filter = { ...(req.filterObj || {}) };
  const courseId = req.params.course || req.query.course;
  const packageId = req.params.package || req.query.package;

  if (courseId) filter.course = mongoose.Types.ObjectId(courseId);
  if (packageId) filter.package = mongoose.Types.ObjectId(packageId);

  const loggedUserId = req.user?._id;
  const loggedUserObjectId = loggedUserId
    ? mongoose.Types.ObjectId(loggedUserId)
    : null;

  const pipeline = [
    { $match: filter },

    // Minimal user info
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
      },
    },
    { $unwind: '$user' },

    // Reactions count and types with counts
    {
      $lookup: {
        from: 'reactions',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              totalCount: { $sum: '$count' },
              typesCount: {
                $push: {
                  k: '$_id',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              count: '$totalCount',
              typesCount: { $arrayToObject: '$typesCount' },
            },
          },
        ],
        as: 'reactionsAgg',
      },
    },
    {
      $addFields: {
        reactionsCount: {
          $ifNull: [{ $first: '$reactionsAgg.count' }, 0],
        },
        reactionTypes: {
          $ifNull: [{ $first: '$reactionsAgg.typesCount' }, {}],
        },
      },
    },

    // Logged user's reaction (type + _id), if logged in
    ...(loggedUserObjectId
      ? [
          {
            $lookup: {
              from: 'reactions',
              let: { postId: '$_id', uid: loggedUserObjectId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$post', '$$postId'] },
                        { $eq: ['$user', '$$uid'] },
                      ],
                    },
                  },
                },
                { $project: { _id: 1, type: 1 } },
                { $limit: 1 },
              ],
              as: 'loggedUserReactionArr',
            },
          },
          {
            $addFields: {
              loggedUserReaction: { $first: '$loggedUserReactionArr' },
            },
          },
        ]
      : [{ $addFields: { loggedUserReaction: null } }]),

    // Comments count
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          { $count: 'count' },
        ],
        as: 'commentsCountArr',
      },
    },
    {
      $addFields: {
        commentsCount: {
          $ifNull: [{ $first: '$commentsCountArr.count' }, 0],
        },
      },
    },

    // Last comment (with its user)
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'user',
              pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 1, content: 1, createdAt: 1, user: 1 } },
        ],
        as: 'lastCommentArr',
      },
    },
    {
      $addFields: {
        lastComment: { $first: '$lastCommentArr' },
      },
    },

    // Shape the outgoing document minimally; map images/documents later in JS
    {
      $project: {
        _id: 1,
        user: 1,
        content: 1,
        sharedTo: 1,
        course: 1,
        package: 1,
        imageCover: 1,
        images: 1,
        documents: 1,
        createdAt: 1,
        updatedAt: 1,
        reactionsCount: 1,
        reactionTypes: 1,
        commentsCount: 1,
        loggedUserReaction: 1,
        lastComment: 1,
      },
    },

    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
  ];

  const [posts, totalDocuments] = await Promise.all([
    Post.aggregate(pipeline),
    Post.countDocuments(filter),
  ]);

  // Map asset URLs
  const data = posts.map((post) => ({
    _id: post._id,
    user: {
      _id: post.user._id,
      name: post.user.name,
      profileImg: post.user.profileImg
        ? `${baseURL}/users/${post.user.profileImg}`
        : null,
    },
    content: post.content,
    sharedTo: post.sharedTo,
    course: post.course,
    package: post.package,
    imageCover: post.imageCover ? `${baseURL}/posts/${post.imageCover}` : null,
    images: Array.isArray(post.images)
      ? post.images.map((img) => `${baseURL}/posts/${img}`)
      : [],
    documents: Array.isArray(post.documents)
      ? post.documents.map((doc, i) => ({
          name: `attachment_${i + 1}`,
          url: `${baseURL}/posts/${doc}`,
        }))
      : [],
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,

    reactionsCount: post.reactionsCount,
    reactionTypes: post.reactionTypes || {},
    commentsCount: post.commentsCount,
    loggedUserReaction: post.loggedUserReaction || null,

    lastComment: post.lastComment
      ? {
          _id: post.lastComment._id,
          content: post.lastComment.content,
          createdAt: post.lastComment.createdAt,
          user: post.lastComment.user
            ? {
                _id: post.lastComment.user._id,
                name: post.lastComment.user.name,
                profileImg: post.lastComment.user.profileImg
                  ? `${baseURL}/users/${post.lastComment.user.profileImg}`
                  : null,
              }
            : null,
        }
      : null,
  }));

  const numberOfPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    results: data.length,
    paginationResult: {
      currentPage: page,
      limit,
      numberOfPages,
    },
    data,
  });
});

//@desc get post
//@route GET api/v1/posts/:id
//@access protected user

exports.getPost = asyncHandler(async (req, res, next) => {
  const baseURL = process.env.BASE_URL;
  const postId = mongoose.Types.ObjectId(req.params.id);
  const loggedUserId = req.user?._id
    ? mongoose.Types.ObjectId(req.user._id)
    : null;

  const pipeline = [
    { $match: { _id: postId } },

    // author (lightweight)
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
      },
    },
    { $unwind: '$user' },

    // reactions: count + distinct types (all in one small group)
    {
      $lookup: {
        from: 'reactions',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              types: { $addToSet: '$type' },
            },
          },
          { $project: { _id: 0, count: 1, types: 1 } },
        ],
        as: 'reactionsAgg',
      },
    },
    {
      $addFields: {
        reactionsCount: { $ifNull: [{ $first: '$reactionsAgg.count' }, 0] },
        reactionTypes: { $ifNull: [{ $first: '$reactionsAgg.types' }, []] },
      },
    },

    // comments: count
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          { $count: 'count' },
        ],
        as: 'commentsCountArr',
      },
    },
    {
      $addFields: {
        commentsCount: { $ifNull: [{ $first: '$commentsCountArr.count' }, 0] },
      },
    },

    // last comment (with its user)
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'user',
              pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 1, content: 1, createdAt: 1, user: 1 } },
        ],
        as: 'lastCommentArr',
      },
    },
    { $addFields: { lastComment: { $first: '$lastCommentArr' } } },

    // logged user's reaction (type + _id), if logged in
    ...(loggedUserId
      ? [
          {
            $lookup: {
              from: 'reactions',
              let: { postId: '$_id', uid: loggedUserId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$post', '$$postId'] },
                        { $eq: ['$user', '$$uid'] },
                      ],
                    },
                  },
                },
                { $project: { _id: 1, type: 1 } },
                { $limit: 1 },
              ],
              as: 'loggedUserReactionArr',
            },
          },
          {
            $addFields: {
              loggedUserReaction: { $first: '$loggedUserReactionArr' },
            },
          },
        ]
      : [{ $addFields: { loggedUserReaction: null } }]),

    // shape
    {
      $project: {
        reactionsAgg: 0,
        commentsCountArr: 0,
        lastCommentArr: 0,
        loggedUserReactionArr: 0,
      },
    },
  ];

  const docs = await Post.aggregate(pipeline);
  if (!docs || docs.length === 0) {
    return next(new ApiError('No post found with that ID', 404));
  }

  const p = docs[0];

  // Map asset URLs
  const data = {
    _id: p._id,
    user: {
      _id: p.user._id,
      name: p.user.name,
      profileImg: p.user.profileImg
        ? `${baseURL}/users/${p.user.profileImg}`
        : null,
    },
    content: p.content,
    sharedTo: p.sharedTo,
    course: p.course,
    package: p.package,
    imageCover: p.imageCover ? `${baseURL}/posts/${p.imageCover}` : null,
    images: Array.isArray(p.images)
      ? p.images.map((img) => `${baseURL}/posts/${img}`)
      : [],
    documents: Array.isArray(p.documents)
      ? p.documents.map((doc, i) => ({
          name: `attachment_${i + 1}`,
          url: `${baseURL}/posts/${doc}`,
        }))
      : [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,

    reactionsCount: p.reactionsCount,
    commentsCount: p.commentsCount,
    reactionTypes: p.reactionTypes || [],
    loggedUserReaction: p.loggedUserReaction || null,

    lastComment: p.lastComment
      ? {
          _id: p.lastComment._id,
          content: p.lastComment.content,
          createdAt: p.lastComment.createdAt,
          user: p.lastComment.user
            ? {
                _id: p.lastComment.user._id,
                name: p.lastComment.user.name,
                profileImg: p.lastComment.user.profileImg
                  ? `${baseURL}/users/${p.lastComment.user.profileImg}`
                  : null,
              }
            : null,
        }
      : null,
  };

  res.status(200).json({ data });
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
      if (!post) return next(new ApiError('post not found ', 404));

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
    console.error('Transaction error:', error);
    if (error instanceof ApiError) {
      // Forward specific ApiError instances
      return next(error);
    }
    // Handle other errors with a generic message
    return next(new ApiError('Error during post deletion', 500));
  }
});
// get best 10 users who have the most posts

exports.getTopProfilePosters = async (req, res, next) => {
  try {
    const topUsers = await Post.aggregate([
      { $match: { sharedTo: 'profile' } },

      // count posts per user
      { $group: { _id: '$user', postsCount: { $sum: 1 } } },

      // sort by count desc (and tie-break by _id for deterministic order)
      { $sort: { postsCount: -1, _id: 1 } },

      // top 10
      { $limit: 10 },

      // join user basic info
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
        },
      },
      { $unwind: '$user' }, // if a user might be missing, add preserveNullAndEmptyArrays: true

      // shape output
      {
        $project: {
          _id: 0,
          user: '$user',
          postsCount: 1,
        },
      },
    ]);

    // (Optional) map profile image to absolute URL
    const baseURL = process.env.BASE_URL;
    const data = topUsers.map((u) => ({
      postsCount: u.postsCount,
      user: {
        _id: u.user._id,
        name: u.user.name,
        profileImg: u.user.profileImg
          ? `${baseURL}/users/${u.user.profileImg}`
          : null,
      },
    }));

    res.status(200).json({ results: data.length, data });
  } catch (err) {
    throw new ApiError(err.message, 500);
  }
};
