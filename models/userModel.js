const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userShcema = new mongoose.Schema(
  {
    invitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startMarketing: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      required: [true, 'name required'],
    },
    email: {
      type: String,
      required: [true, 'email required'],
      unique: true,
      lowercase: true,
    },
    phone: String,
    profileImg: String,
    coverImg: String,
    google: {
      id: String,
      email: String,
    },
    password: {
      type: String,
      required: [
        function () {
          return !this.isOAuthUser;
        },
        'password required',
      ],
      minlength: [8, 'too short Password'],
    },
    isOAuthUser: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    passwordResetVerified: Boolean,
    // email verification
    emailVerificationCode: String,
    emailVerificationExpires: Date,
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'campaign'],
      default: 'user',
    },
    isInstructor: Boolean,
    country: String,
    active: {
      type: Boolean,
      default: true,
    },

    treeHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isTreeHead: {
      type: Boolean,
      default: false,
    },
    placmentExam: {
      exam: {
        type: mongoose.Schema.ObjectId,
        ref: 'Exam',
      },
      course: {
        type: mongoose.Schema.ObjectId,
        ref: 'Course',
      },
      status: {
        type: String,
        enum: ['failed', 'Completed'],
      },
      score: Number,
      attemptDate: Date,
    },
    authToReview: {
      type: Boolean,
      default: false,
    },
    following: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    followers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true },
);

userShcema.methods.toJSON = function () {
  const obj = this.toObject();

  // Function to remove sensitive fields
  const removeSensitiveFields = (fields) => {
    fields.forEach((field) => delete obj[field]);
  };

  // Define sensitive fields
  const sensitiveFields = [
    'passwordChangedAt',
    'passwordResetCode',
    'passwordResetExpires',
    'password',
    'emailVerificationCode',
    'emailVerificationExpires',
  ];

  // Remove common sensitive fields
  removeSensitiveFields(sensitiveFields);

  return obj;
};

userShcema.pre('save', async function (next) {
  //if password field is not modified go to next middleware
  if (!this.isModified('password')) return next();
  // Hashing user password
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const setProfileImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.profileImg) {
    const profileImageUrl = `${process.env.BASE_URL}/users/${doc.profileImg}`;
    doc.profileImg = profileImageUrl;
  }
  if (doc.coverImg) {
    const coverImgUrl = `${process.env.BASE_URL}/users/${doc.coverImg}`;
    doc.coverImg = coverImgUrl;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
userShcema.post('init', (doc) => {
  setProfileImageURL(doc);
});
// it work with create
userShcema.post('save', (doc) => {
  setProfileImageURL(doc);
});

const User = mongoose.model('User', userShcema);
module.exports = User;
