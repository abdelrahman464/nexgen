const mongoose = require('mongoose');

const couponSchema = mongoose.Schema(
  {
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isAdminCoupon: {
      type: Boolean,
      default: false,
    },
    couponName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    discount: Number,
    maxUsageTimes: {
      type: Number,
      required: true,
    },
    usedTimes: {
      type: Number,
      default: 0,
    },
    reason: String, // why this coupon was given
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'active', 'rejected'],
    },
    // apply for specific courses or courses package
    courses: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        },
      ],
    },
    coursePackages: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CoursePackage',
        },
      ],
    },
    packages: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Package',
        },
      ],
    },
  },
  { timestamps: true },
);
// ^find => it mean if part of of teh word contains find
couponSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: 'marketer', select: 'name email profileImg isInstructor' });
  next();
});

//2- create model
module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
