const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'order must be belong to user'],
    },
    marketer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    description: String,
    course: {
      type: mongoose.Schema.ObjectId,
      ref: 'Course',
    },
    package: {
      type: mongoose.Schema.ObjectId,
      ref: 'Package',
    },
    coursePackage: {
      type: mongoose.Schema.ObjectId,
      ref: 'CoursePackage',
    },
    totalOrderPrice: {
      type: Number,
    },
    paymentMethodType: {
      type: String,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    isResale: {
      type: Boolean,
      default: false,
    },
    marketerPercentage: {
      type: Number,
      default: 0,
    },
    instructorPercentage: {
      type: Number,
      default: 0,
    },
    instructorProfits: {
      type: Number,
      default: 0,
    },
    coupon: String,
    paidAt: Date,
    paypalOrderId: String,
    // Apple IAP specific fields
    appleTransactionId: {
      type: String,
      sparse: true, // Allows multiple null values
    },
    appleOriginalTransactionId: {
      type: String,
      sparse: true,
    },
    appleProductId: {
      type: String,
    },
    appleReceiptData: {
      type: String, // Store for future verification if needed
    },
  },
  { timestamps: true },
);
OrderSchema.index({ appleTransactionId: 1 });
OrderSchema.index({ appleOriginalTransactionId: 1 });

OrderSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: '_id name phone email profileImg createdAt',
  })
    .populate({
      path: 'marketer',
      select: 'name email',
    })
    .populate({
      path: 'course',
      select: 'title -category price',
    })
    .populate({
      path: 'coursePackage',
      select: 'title price',
    })
    .populate({
      path: 'package',
      select: 'title price',
    });
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
