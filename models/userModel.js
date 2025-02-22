const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    invitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitationKey: {
      type: String,
      default: "defaultKey",
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name required"],
    },
    email: {
      type: String,
      required: [true, "email required"],
      unique: true,
      lowercase: true,
    },
    bio: String,
    idNumber: String,
    //start uploads
    phone: String,
    profileImg: String,
    coverImg: String,
    idDocuments: [String],
    //end uploads
    idVerification: {
      type: String,
      enum: ["pending", "verified", "rejected"],
    },
    note: {
      type: String,
    },
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
        "password required",
      ],
      minlength: [8, "too short Password"],
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
      enum: ["user", "admin", "campaign"],
      default: "user",
    },
    isInstructor: Boolean,
    isCustomerService: Boolean,
    country: String,
    active: {
      type: Boolean,
      default: true,
    },
    placementExam: {
      exam: {
        type: mongoose.Schema.ObjectId,
        ref: "Exam",
      },
      course: {
        type: mongoose.Schema.ObjectId,
        ref: "Course",
      },
      status: {
        type: String,
        enum: ["failed", "Completed"],
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
        user: { type: mongoose.Schema.ObjectId, ref: "User" },
        notificationBell: {
          type: Boolean,
          default: false,
        },
      },
    ],
    followers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    //to calculate the total time spent by the user
    timeSpent: {
      totalTimeSpent: {
        type: Number,
        default: 0, // Total time in seconds
      },
      lastLogin: {
        type: Date,
      },
      monthlyTimeSpent: {
        type: Number,
        default: 0, // Time spent in the current 30-day period in seconds
      },
      monthlyStartDate: {
        type: Date, // Start date for the 30-day calculation
      },
    },
    isMarketer: {
      type: Boolean,
    },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Function to remove sensitive fields
  const removeSensitiveFields = (fields) => {
    fields.forEach((field) => delete obj[field]);
  };

  // Define sensitive fields
  const sensitiveFields = [
    "passwordChangedAt",
    "passwordResetCode",
    "passwordResetExpires",
    "password",
    "emailVerificationCode",
    "emailVerificationExpires",
  ];

  // Remove common sensitive fields
  removeSensitiveFields(sensitiveFields);

  return obj;
};

userSchema.pre("save", async function (next) {
  //if password field is not modified go to next middleware
  if (!this.isModified("password")) return next();
  // Hashing user password
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const setProfileImageURL = (doc) => {
  //return image base url + image name
  if (doc.profileImg) {
    const profileImageUrl = `${process.env.BASE_URL}/users/${doc.profileImg}`;
    doc.profileImg = profileImageUrl;
  }
  if (doc.coverImg) {
    const coverImgUrl = `${process.env.BASE_URL}/users/${doc.coverImg}`;
    doc.coverImg = coverImgUrl;
  }
  if (doc.idDocuments) {
    const imageListWithUrl = [];
    doc.idDocuments.forEach((image) => {
      const imageUrl = `${process.env.BASE_URL}/users/idDocuments/${image}`;
      imageListWithUrl.push(imageUrl);
    });
    doc.idDocuments = imageListWithUrl;
  }
};
//after initialize the doc in db
// check if the document contains image
// it work with findOne,findAll,update
userSchema.post("init", (doc) => {
  setProfileImageURL(doc);
});
// it work with create
userSchema.post("save", (doc) => {
  setProfileImageURL(doc);
});

const User = mongoose.model("User", userSchema);
module.exports = User;
