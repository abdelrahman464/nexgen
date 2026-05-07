import { Schema } from 'mongoose';

export const OrderSchema = new Schema<any>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'order must be belong to user'],
    },
    marketer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    description: String,
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: 'Package',
    },
    coursePackage: {
      type: Schema.Types.ObjectId,
      ref: 'CoursePackage',
    },
    totalOrderPrice: Number,
    paymentMethodType: String,
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
  },
  { timestamps: true },
);

OrderSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: '_id name phone email profileImg createdAt' })
    .populate({ path: 'marketer', select: 'name email' })
    .populate({ path: 'course', select: 'title -category price' })
    .populate({ path: 'coursePackage', select: 'title price' })
    .populate({ path: 'package', select: 'title price' });
  next();
});

export const UserSubscriptionSchema = new Schema<any>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  package: {
    type: Schema.Types.ObjectId,
    ref: 'Package',
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
});

UserSubscriptionSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'package',
    select: 'title course subscriptionDurationDays type',
  });
  next();
});

export const PaymentWebhookEventSchema = new Schema<any>(
  {
    provider: {
      type: String,
      enum: ['stripe', 'plisio', 'lahza'],
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    rawHash: String,
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
    },
    payload: Schema.Types.Mixed,
    processedAt: Date,
    error: String,
  },
  { timestamps: true },
);

PaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
