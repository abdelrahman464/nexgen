import { Schema } from 'mongoose';

const addFileUrl = (value: string | undefined, folder: string) => {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${process.env.BASE_URL}/${folder}/${value}`;
};

const setImageUrl = (doc: any, folder: string, field = 'image') => {
  if (doc?.[field]) doc[field] = addFileUrl(doc[field], folder);
};

const ragSyncSchema = new Schema(
  {
    fileId: String,
    vectorStoreId: String,
    contentHash: String,
    syncedAt: Date,
    status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
    error: String,
  },
  { _id: false },
);

const commonCatalogFields = {
  instructor: { type: Schema.Types.ObjectId, ref: 'User' },
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  title: { type: String, i18n: true },
  slug: { type: String, lowercase: true },
  description: { type: String, i18n: true },
  highlights: [{ type: Object, i18n: true }],
  whatWillLearn: [{ type: Object, i18n: true }],
  coursePrerequisites: [{ type: Object, i18n: true }],
  whoThisCourseFor: [{ type: Object, i18n: true }],
  image: String,
  status: { type: String, enum: ['active', 'pending', 'inActive'], default: 'pending' },
  order: { type: Number, default: 0, index: true },
  price: { type: Number, trim: true, max: [200000, 'Too long price'] },
  priceAfterDiscount: Number,
  metaTitle: { type: String, i18n: true },
  metaDescription: { type: String, i18n: true },
  keywords: { type: String, i18n: true },
  rag: { type: ragSyncSchema, default: () => ({ status: 'pending' }) },
  appleProductId: String,
};

export const CourseSchema = new Schema<any>(
  {
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    instructor: { type: Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, i18n: true },
    description: { type: String, i18n: true },
    slug: { type: String, lowercase: true },
    rating: { type: Number, default: 0 },
    certificateDescription: { type: String, i18n: true },
    type: String,
    highlights: [{ type: Object, i18n: true }],
    whatWillLearn: [{ type: Object, i18n: true }],
    coursePrerequisites: [{ type: Object, i18n: true }],
    whoThisCourseFor: [{ type: Object, i18n: true }],
    image: String,
    colors: {
      bgColor: String,
      bgDarkMode: String,
      fontColor: String,
      fontDarkMode: String,
    },
    price: { type: Number, trim: true, max: [200000, 'Too long Course price'] },
    priceAfterDiscount: Number,
    ratingsAverage: {
      type: Number,
      min: [1, 'rating must be between 1.0 and 5.0'],
      max: [5, 'rating must be between 1.0 and 5.0'],
      set: (v: number) => parseFloat(v.toFixed(1)),
    },
    coursePercentage: Number,
    courseDuration: Number,
    ratingsQuantity: { type: Number, default: 0 },
    needAccessibleCourse: { type: Boolean, default: true },
    accessibleCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    instructorPercentage: Number,
    courseWelcomeMessage: { type: String, i18n: true },
    goodByeMessage: { type: String, i18n: true },
    hasQuiz: Boolean,
    freePackageSubscriptionInDays: Number,
    metaTitle: { type: String, i18n: true },
    metaDescription: { type: String, i18n: true },
    keywords: { type: String, i18n: true },
    examQuestionsNumber: { type: Number, default: 0 },
    examTitle: String,
    showOnBanner: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inActive', 'pending'], default: 'pending' },
    order: { type: Number, default: 0, index: true },
    promotionVideo: String,
    rag: { type: ragSyncSchema, default: () => ({ status: 'pending' }) },
    appleProductId: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
CourseSchema.index({ status: 1 });
CourseSchema.index({ instructor: 1, status: 1 });
CourseSchema.index({ 'rag.status': 1 });
CourseSchema.virtual('reviews', { ref: 'Review', foreignField: 'course', localField: '_id' });
CourseSchema.pre(/^find/, function (next) {
  if (this.getOptions && this.getOptions().skipPopulate) return next();
  this.populate({ path: 'category', select: 'title' })
    .populate({ path: 'instructor', select: 'name email profileImg' })
    .populate({
      path: 'accessibleCourses',
      select: 'title image price priceAfterDiscount status slug',
      options: { skipPopulate: true },
    });
  return next();
});
CourseSchema.post('init', (doc) => setImageUrl(doc, 'courses'));
CourseSchema.post('save', (doc) => setImageUrl(doc, 'courses'));

export const PackageSchema = new Schema<any>(
  {
    ...commonCatalogFields,
    course: { type: Schema.Types.ObjectId, ref: 'Course', unique: true },
    subscriptionDurationDays: Number,
    type: { type: String, enum: ['service', 'course'], default: 'service' },
  },
  { timestamps: true },
);
PackageSchema.index({ 'rag.status': 1 });
PackageSchema.pre(/^find/, function (next) {
  if (this.getOptions && this.getOptions().skipPopulate) return next();
  this.populate({ path: 'course', select: 'title colors -accessibleCourses -category' })
    .populate({ path: 'category', select: 'title' })
    .populate({ path: 'instructor', select: 'name email profileImg' });
  return next();
});
PackageSchema.post('init', (doc) => setImageUrl(doc, 'packages'));
PackageSchema.post('save', (doc) => setImageUrl(doc, 'packages'));

export const CoursePackageSchema = new Schema<any>(
  {
    ...commonCatalogFields,
    courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    profitableCourses: [
      {
        course: { type: Schema.Types.ObjectId, ref: 'Course' },
        instructorPercentage: Number,
        instructorProfits: Number,
      },
    ],
    type: String,
  },
  { timestamps: true },
);
CoursePackageSchema.index({ 'rag.status': 1 });
CoursePackageSchema.pre(/^find/, function (next) {
  if (this.getOptions && this.getOptions().skipPopulate) return next();
  this.populate({ path: 'courses', select: 'title courseDuration' })
    .populate({ path: 'category', select: 'title' })
    .populate({ path: 'instructor', select: 'name email profileImg' });
  return next();
});
CoursePackageSchema.post('init', (doc) => setImageUrl(doc, 'coursePackages'));
CoursePackageSchema.post('save', (doc) => setImageUrl(doc, 'coursePackages'));
