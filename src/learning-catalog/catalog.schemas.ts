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

export const SectionSchema = new Schema<any>(
  {
    title: { type: String, required: [true, 'section title required'], minlength: [3, 'too short category title'], i18n: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    order: { type: Number },
  },
  { timestamps: true },
);

export const LessonSchema = new Schema<any>(
  {
    section: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    title: { type: String, required: true, i18n: true },
    description: { type: String, i18n: true },
    type: { type: String, enum: ['live', 'recorded'], default: 'recorded' },
    image: String,
    videoUrl: { type: String, required: true },
    attachments: [String],
    order: { type: Number },
    lessonDuration: { type: Number, required: true },
    assignmentTitle: { type: String, i18n: true },
    assignmentDescription: { type: String, i18n: true },
    quizTitle: String,
    hasQuiz: { type: Boolean, default: false },
    assignmentFile: String,
    isRequireAnalytic: { type: Boolean, default: false },
    examQuestionsNumber: { type: Number, default: 0 },
    examTitle: String,
  },
  { timestamps: true },
);
LessonSchema.index({ course: 1, order: 1 });
LessonSchema.pre(/^find/, function (next) {
  this.populate({ path: 'course', select: '_id title -category' });
  return next();
});
LessonSchema.post('init', (doc) => {
  setImageUrl(doc, 'lessons/images', 'image');
  setImageUrl(doc, 'lessons/assignments', 'assignmentFile');
  if (Array.isArray(doc.attachments)) {
    doc.attachments = doc.attachments.map((file: string) => addFileUrl(file, 'lessons/attachments'));
  }
});
LessonSchema.post('save', (doc) => {
  setImageUrl(doc, 'lessons/images', 'image');
  setImageUrl(doc, 'lessons/assignments', 'assignmentFile');
  if (Array.isArray(doc.attachments)) {
    doc.attachments = doc.attachments.map((file: string) => addFileUrl(file, 'lessons/attachments'));
  }
});

export const CourseProgressSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    modelExam: String,
    score: Number,
    status: { type: String, enum: ['notTaken', 'failed', 'Completed'], default: 'notTaken' },
    wrongAnswers: [
      {
        question: { type: Schema.Types.ObjectId },
        answer: String,
      },
    ],
    progress: [
      {
        lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
        modelExam: String,
        status: { type: String, enum: ['failed', 'Completed'], default: 'Completed' },
        passAnalytics: Boolean,
        examScore: { type: Number, default: 0 },
        attemptDate: { type: Date, default: Date.now },
        wrongAnswers: [
          {
            question: { type: Schema.Types.ObjectId },
            answer: String,
          },
        ],
      },
    ],
    certificate: {
      _id: Schema.Types.ObjectId,
      file: String,
    },
    attemptDate: Date,
  },
  { timestamps: true },
);
CourseProgressSchema.index({ user: 1, course: 1 }, { unique: true });
CourseProgressSchema.index({ user: 1 });
CourseProgressSchema.index({ course: 1 });
CourseProgressSchema.index({ 'progress.lesson': 1 });
CourseProgressSchema.pre(/^find/, function (next) {
  this.populate({ path: 'progress.lesson', select: 'title order' });
  return next();
});
CourseProgressSchema.post('init', (doc) => setImageUrl(doc?.certificate, 'certificate', 'file'));
CourseProgressSchema.post('save', (doc) => setImageUrl(doc?.certificate, 'certificate', 'file'));

export const ExamSchema = new Schema<any>(
  {
    title: { type: Object, i18n: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    type: { type: String, enum: ['course', 'lesson', 'placement'], required: true },
    model: { type: String, enum: ['A', 'B'], default: 'A' },
    passingScore: { type: Number, required: true, default: 70 },
    questions: [
      {
        question: String,
        questionImage: String,
        options: [String],
        correctOption: Number,
        grade: Number,
      },
    ],
  },
  { timestamps: true },
);
const setQuestionImageUrls = (doc: any) => {
  if (!Array.isArray(doc?.questions)) return;
  doc.questions.forEach((question: any) => {
    question.questionImage = addFileUrl(question.questionImage, 'questions');
    if (Array.isArray(question.options)) {
      question.options = question.options.map((option: string) => {
        if (!option || option.startsWith('http')) return option;
        return /\.(jpg|jpeg|png|webp)$/i.test(option) ? addFileUrl(option, 'questions/options') : option;
      });
    }
  });
};
ExamSchema.post('init', (doc) => setQuestionImageUrls(doc));
ExamSchema.post('save', (doc) => setQuestionImageUrls(doc));

export const AnalyticsSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    marketer: { type: Schema.Types.ObjectId, ref: 'User' },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    content: { type: String, required: true },
    isPassed: { type: Boolean, default: false },
    isSeen: { type: Boolean, default: false },
    marketerComment: String,
    imageCover: String,
    media: [String],
  },
  { timestamps: true },
);
AnalyticsSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' });
  return next();
});
AnalyticsSchema.post('init', (doc) => {
  setImageUrl(doc, 'analytics', 'imageCover');
  if (Array.isArray(doc?.media)) doc.media = doc.media.map((file: string) => addFileUrl(file, 'analytics'));
});
AnalyticsSchema.post('save', (doc) => {
  setImageUrl(doc, 'analytics', 'imageCover');
  if (Array.isArray(doc?.media)) doc.media = doc.media.map((file: string) => addFileUrl(file, 'analytics'));
});
