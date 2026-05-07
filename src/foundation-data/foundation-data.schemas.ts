import { Schema, Types } from 'mongoose';
import { sendPushNotificationToMultiple } from '../common/services/push-notification.service';

const { sendNotification } = require('../../socket/index');

const setFileUrl = (doc: any, folder: string, field = 'image') => {
  if (doc?.[field] && !String(doc[field]).startsWith('http')) {
    doc[field] = `${process.env.BASE_URL}/${folder}/${doc[field]}`;
  }
};

export const ContactSchema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true },
);

export const ContactUsSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], trim: true, lowercase: true },
    message: { type: String, required: [true, 'Message is required'], trim: true },
  },
  { timestamps: true },
);

export const SystemReviewSchema = new Schema(
  {
    title: String,
    ratings: { type: Number, min: [1, 'min value is 1.0'], max: [5, 'max value is 5.0'], required: [true, 'review ratings required'] },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'review must belong to user'] },
    replay: String,
  },
  { timestamps: true },
);
SystemReviewSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' });
  next();
});

export const ReviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'review must belong to user'] },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: [true, 'review must belong to Course'] },
    title: String,
    ratings: { type: Number, min: [1, 'min value is 1.0'], max: [5, 'max value is 5.0'] },
    reply: String,
  },
  { timestamps: true },
);
ReviewSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' });
  next();
});
ReviewSchema.statics.calcAverageRatingsAndQuantity = async function (courseId: Types.ObjectId) {
  const result = await this.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: '$course', avgRatings: { $avg: '$ratings' }, ratingsQuantity: { $sum: 1 } } },
  ]);
  const Course = (this as any).db.model('Course');
  await Course.findByIdAndUpdate(courseId, {
    ratingsAverage: result.length ? Number(result[0].avgRatings.toFixed(1)) : 0,
    ratingsQuantity: result.length ? result[0].ratingsQuantity : 0,
  });
};
ReviewSchema.post('remove', async function (this: any) {
  await (this.constructor as any).calcAverageRatingsAndQuantity(this.course);
});
ReviewSchema.post('save', async function (this: any) {
  await (this.constructor as any).calcAverageRatingsAndQuantity(this.course);
});

export const CategorySchema = new Schema(
  {
    title: { type: String, required: [true, 'category title required'], minlength: [3, 'too short category title'], i18n: true },
    image: String,
  },
  { timestamps: true },
);
CategorySchema.post('init', (doc) => setFileUrl(doc, 'categories'));
CategorySchema.post('save', (doc) => setFileUrl(doc, 'categories'));

export const ArticalSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: [true, 'Article title required'], trim: true, minlength: 2, i18n: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, required: [true, 'Article description required'], trim: true, minlength: 10, i18n: true },
    content: { type: String, required: [true, 'Article content required'], i18n: true },
    date: { type: Date, default: () => new Date() },
    imageCover: { type: String, required: true },
    images: [String],
    readTime: { type: String, required: true },
    status: { type: String, enum: ['active', 'pending'], default: 'pending' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
ArticalSchema.pre(/^find/, function (next) {
  this.populate({ path: 'author', select: '_id name email profileImg' });
  next();
});
ArticalSchema.post('init', (doc) => setFileUrl(doc, 'blog/artical', 'imageCover'));
ArticalSchema.post('save', (doc) => setFileUrl(doc, 'blog/artical', 'imageCover'));

export const CouponSchema = new Schema(
  {
    marketer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isAdminCoupon: { type: Boolean, default: false },
    couponName: { type: String, required: true, unique: true, trim: true },
    discount: Number,
    maxUsageTimes: { type: Number, required: true },
    usedTimes: { type: Number, default: 0 },
    reason: String,
    status: { type: String, default: 'pending', enum: ['pending', 'active', 'rejected'] },
    courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    coursePackages: [{ type: Schema.Types.ObjectId, ref: 'CoursePackage' }],
    packages: [{ type: Schema.Types.ObjectId, ref: 'Package' }],
  },
  { timestamps: true },
);
CouponSchema.pre(/^find/, function (next) {
  this.populate({ path: 'marketer', select: 'name email profileImg isInstructor' });
  next();
});

export const EventSchema = new Schema(
  {
    title: { type: String, required: [true, 'event title required'], minlength: [3, 'too short event title'], i18n: true },
    description: { type: String, minlength: [3, 'too short event description'], i18n: true },
    date: Date,
    link: String,
    image: String,
  },
  { timestamps: true },
);
EventSchema.post('init', (doc) => setFileUrl(doc, 'events'));
EventSchema.post('save', (doc) => setFileUrl(doc, 'events'));

export const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: ['true', 'User required'] },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    followedUser: { type: Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: [true, 'Message required'], i18n: true },
    file: String,
    read: { type: Boolean, default: false },
    type: { type: String, enum: ['system', 'post', 'chat', 'certificate', 'follow', 'order'], default: 'system' },
  },
  { timestamps: true },
);
NotificationSchema.pre(/^find/, function (next) {
  this.populate({ path: 'post', select: 'content -user -package -course' })
    .populate({ path: 'followedUser', select: 'name email profileImg' })
    .populate({ path: 'user', select: 'name email profileImg' })
    .populate({ path: 'chat', select: '-participants -course' });
  next();
});
NotificationSchema.post('init', (doc) => setFileUrl(doc, doc.type === 'order' ? 'orders' : 'certificate', 'file'));
NotificationSchema.post('save', (doc) => setFileUrl(doc, doc.type === 'order' ? 'orders' : 'certificate', 'file'));
NotificationSchema.post('save', async (doc: any) => {
  try {
    const User = doc.constructor.db.model('User');
    const user = await User.findById(doc.user).select('lang fcmTokens pushNotificationsEnabled');
    if (!user) return;
    const messageObject: any = doc.toObject().message;
    const notificationTitle = user.lang === 'ar' ? messageObject.ar : messageObject.en;
    sendNotification(doc.user.toString(), { ...doc.toObject(), message: notificationTitle });
    if (user.fcmTokens?.length > 0 && user.pushNotificationsEnabled !== false) {
      await sendPushNotificationToMultiple(user.fcmTokens, { title: 'Nexgen Academy', body: notificationTitle }, {
        notificationId: doc._id.toString(),
        type: doc.type,
        ...(doc.post && { postId: doc.post.toString() }),
        ...(doc.chat && { chatId: doc.chat.toString() }),
        ...(doc.course && { courseId: doc.course.toString() }),
        ...(doc.followedUser && { followedUserId: doc.followedUser.toString() }),
      });
    }
  } catch (error) {
    console.error('Error emitting notification:', error);
  }
});
