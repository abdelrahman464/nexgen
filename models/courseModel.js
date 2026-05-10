const mongoose = require('mongoose');

const ragSyncSchema = new mongoose.Schema(
  {
    fileId: String,
    vectorStoreId: String,
    contentHash: String,
    syncedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending',
    },
    error: String,
  },
  { _id: false },
);

const courseSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    //i18n
    title: {
      type: String,
      i18n: true,
    },
    description: {
      type: String,
      i18n: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    //use this field to know how many starts in certificate image
    rating: {
      type: Number,
      default: 0,
    },
    certificateDescription: {
      type: String,
      i18n: true,
    },

    type: String,
    highlights: [
      {
        type: Object,
        i18n: true,
      },
    ],
    whatWillLearn: [
      {
        type: Object,
        i18n: true,
      },
    ],
    coursePrerequisites: [
      {
        type: Object,
        i18n: true,
      },
    ],
    whoThisCourseFor: [
      {
        type: Object,
        i18n: true,
      },
    ],
    //
    image: {
      type: String,
    },
    colors: {
      bgColor: String,
      bgDarkMode: String,
      fontColor: String,
      fontDarkMode: String,
    },

    price: {
      type: Number,
      trim: true,
      max: [200000, 'Too long Course price'],
    },
    priceAfterDiscount: {
      type: Number,
    },
    ratingsAverage: {
      type: Number,
      min: [1, 'rating must be between 1.0 and 5.0'],
      max: [5, 'rating must be between 1.0 and 5.0'],
      set: (v) => parseFloat(v.toFixed(1)), // Rounds to 2 decimal places
    },
    coursePercentage: Number,
    courseDuration: {
      type: Number,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    needAccessibleCourse: {
      type: Boolean,
      default: true,
    },
    accessibleCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    instructorPercentage: {
      type: Number,
    },
    courseWelcomeMessage: { type: String, i18n: true },
    goodByeMessage: { type: String, i18n: true },
    whatIsNextTitle: { type: String, i18n: true },
    whatIsNextDescription: { type: String, i18n: true },
    nextCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    hasQuiz: Boolean,
    freePackageSubscriptionInDays: Number,
    // SEO fields
    metaTitle: {
      type: String,
      i18n: true,
    },
    metaDescription: {
      type: String,
      i18n: true,
    },
    keywords: {
      type: String,
      i18n: true,
    },
    examQuestionsNumber: {
      type: Number,
      default: 0,
    },
    examTitle: {
      type: String,
    },
    showOnBanner: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inActive" , "pending"],
      default: "pending",
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    promotionVideo: String,
    rag: {
      type: ragSyncSchema,
      default: () => ({ status: 'pending' }),
    },
    appleProductId: String,

  },
  {
    timestamps: true,
    // to enable vitual population
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

courseSchema.index({ status: 1 });
courseSchema.index({ instructor: 1, status: 1 }); // Compound index for instructor queries with status filter
courseSchema.index({ 'rag.status': 1 });

// virtual field =>reviews
courseSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'course',
  localField: '_id',
});

courseSchema.pre(/^find/, function (next) {
  // allow callers to opt-out via query options
  if (this.getOptions && this.getOptions().skipPopulate) return next();
  
  this.populate({ path: 'category', select: 'title' })
  .populate({ path: 'instructor', select: 'name email profileImg signatureImage' })
  .populate({ 
      path: 'accessibleCourses',
      select: 'title image price priceAfterDiscount status slug',
      options: { skipPopulate: true }  // Prevent recursive population
    })
  .populate({
      path: 'nextCourses',
      select: 'title description image price priceAfterDiscount slug type courseDuration rating ratingsAverage ratingsQuantity category instructor status createdAt',
      options: { skipPopulate: true },
    })
  next();
});

const setCourseImageURL = (doc) => {
  //return image base url + image name
  if (doc.image) {
    const CourseImageURL = `${process.env.BASE_URL}/courses/${doc.image}`;
    doc.image = CourseImageURL;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
courseSchema.post('init', (doc) => {
  setCourseImageURL(doc);
});
// it work with create
courseSchema.post('save', (doc) => {
  setCourseImageURL(doc);
});

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
