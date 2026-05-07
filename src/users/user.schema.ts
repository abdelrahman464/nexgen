import bcrypt from 'bcryptjs';
import { Schema } from 'mongoose';

const addFileBaseUrl = (value: string | undefined, folder: string) => {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${process.env.BASE_URL}/${folder}/${value}`;
};

const setUserFileUrls = (doc: any) => {
  if (!doc) return;
  doc.profileImg = addFileBaseUrl(doc.profileImg, 'users');
  doc.coverImg = addFileBaseUrl(doc.coverImg, 'users');
  doc.signatureImage = addFileBaseUrl(doc.signatureImage, 'users');
  if (Array.isArray(doc.idDocuments)) {
    doc.idDocuments = doc.idDocuments.map((image: string) => addFileBaseUrl(image, 'users/idDocuments'));
  }
};

export const UserSchema = new Schema(
  {
    lang: String,
    invitor: { type: Schema.Types.ObjectId, ref: 'User' },
    coach: { type: Schema.Types.ObjectId, ref: 'User' },
    invitationKey: { type: String, default: 'defaultKey' },
    name: { type: String, trim: true, required: [true, 'name required'] },
    email: { type: String, required: [true, 'email required'], unique: true, lowercase: true },
    bio: String,
    idNumber: String,
    country: String,
    phone: String,
    profileImg: String,
    coverImg: String,
    idDocuments: [String],
    idVerification: { type: String, enum: ['pending', 'verified', 'rejected'] },
    note: String,
    google: {
      id: String,
      email: String,
    },
    password: {
      type: String,
      required: [
        function (this: any) {
          return !this.isOAuthUser;
        },
        'password required',
      ],
      minlength: [8, 'too short Password'],
    },
    isOAuthUser: { type: Boolean, default: false },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    passwordResetVerified: Boolean,
    emailVerificationCode: String,
    emailVerificationExpires: Date,
    emailVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ['user', 'admin', 'campaign', 'moderator'],
      default: 'user',
    },
    isInstructor: Boolean,
    signatureImage: {
      type: String,
      required: [
        function (this: any) {
          return this.isInstructor;
        },
        'signature Image Is Required',
      ],
    },
    isCustomerService: Boolean,
    active: { type: Boolean, default: true },
    placementExam: {
      exam: { type: Schema.Types.ObjectId, ref: 'Exam' },
      course: { type: Schema.Types.ObjectId, ref: 'Course' },
      status: { type: String, enum: ['failed', 'Completed'] },
      score: Number,
      attemptDate: Date,
    },
    authToReview: { type: Boolean, default: false },
    following: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        notificationBell: { type: Boolean, default: false },
      },
    ],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    timeSpent: {
      totalTimeSpent: { type: Number, default: 0 },
      lastLogin: Date,
      monthlyTimeSpent: { type: Number, default: 0 },
      monthlyStartDate: Date,
    },
    isMarketer: Boolean,
    isAffiliateMarketer: Boolean,
    fcmTokens: [String],
    pushNotificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  [
    'passwordChangedAt',
    'passwordResetCode',
    'passwordResetExpires',
    'password',
    'emailVerificationCode',
    'emailVerificationExpires',
  ].forEach((field) => delete obj[field]);
  return obj;
};

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

UserSchema.post('init', (doc) => setUserFileUrls(doc));
UserSchema.post('save', (doc) => setUserFileUrls(doc));
