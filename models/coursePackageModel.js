const mongoose = require('mongoose');

const coursePackageSchema = new mongoose.Schema(
  {
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    title: {
      type: String,
      required: [true, 'Package title is required'],
      i18n: true,
    },
    description: { type: String, required: true, i18n: true },
    highlights: [{ type: Object, i18n: true }],

    price: {
      type: Number,
      required: [true, 'Package price is required'],
      trim: true,
      max: [200000, 'Too long Package price'],
    },
    priceAfterDiscount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);
coursePackageSchema.pre(/^find/, function (next) {
  this.populate({ path: 'courses', select: 'title' });
  next();
});
module.exports = mongoose.model('CoursePackage', coursePackageSchema);
