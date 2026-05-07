import { Schema } from 'mongoose';

const invoiceStatus = {
  type: String,
  enum: ['pending', 'paid', 'rejected'],
  default: 'pending',
};

export const MarketingLogSchema = new Schema<any>(
  {
    role: { type: String, enum: ['head', 'marketer', 'instructor', 'affiliate'] },
    marketer: { type: Schema.Types.ObjectId, ref: 'User' },
    invitor: { type: Schema.Types.ObjectId, ref: 'User' },
    fallBackCoach: { type: Schema.Types.ObjectId, ref: 'User' },
    invitationKeys: [String],
    paymentDetails: {
      paymentMethod: String,
      receiverAcc: String,
    },
    totalSalesMoney: { type: Number, default: 0 },
    profitsCalculationMethod: String,
    profitPercentage: Number,
    profits: { type: Number, default: 0 },
    commissionsProfits: { type: Number, default: 0 },
    totalProfits: { type: Number, default: 0 },
    commissionsProfitsCalculationMethod: String,
    commissionsProfitsPercentage: Number,
    withdrawals: { type: Number, default: 0 },
    clicks: [{ month: String, year: Number, count: Number }],
    sales: [
      {
        purchaser: { type: Schema.Types.ObjectId, ref: 'User' },
        order: { type: Schema.Types.ObjectId, ref: 'Order' },
        instructorProfits: Number,
        percentage: Number,
        profits: Number,
        amount: Number,
        itemType: String,
        item: { type: String, i18n: true },
        Date: { type: Date, default: Date.now },
      },
    ],
    commissions: [
      {
        member: { type: Schema.Types.ObjectId, ref: 'User' },
        profit: Number,
        lastUpdate: { type: Date, default: Date.now },
      },
    ],
    invoices: [
      {
        totalSalesMoney: Number,
        mySales: Number,
        profitPercentage: Number,
        profits: Number,
        createdAt: { type: Date, default: Date.now },
        createdBy: String,
        orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
        status: invoiceStatus,
        paidAt: Date,
      },
    ],
    walletInvoices: [
      {
        profits: Number,
        reasonToWithdraw: String,
        desc: String,
        createdAt: { type: Date, default: Date.now },
        status: invoiceStatus,
        paidAt: Date,
      },
    ],
    commissionsInvoices: [
      {
        profits: Number,
        desc: String,
        createdAt: { type: Date, default: Date.now },
        status: invoiceStatus,
        paidAt: Date,
      },
    ],
    profitableItems: [
      {
        itemId: { type: Schema.Types.ObjectId, required: true },
        itemType: { type: String, required: true },
        percentage: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);

MarketingLogSchema.pre('save', function (next) {
  if (this.invitationKeys && Array.isArray(this.invitationKeys)) {
    this.invitationKeys = this.invitationKeys.map((key: string) => key.replace(/\s+/g, '-'));
  }
  next();
});

const instructorCommissionSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    type: String,
    amount: Number,
    percentage: Number,
    totalProfits: Number,
    profit: Number,
    marketer: { type: Schema.Types.ObjectId, ref: 'User' },
    marketerPercentage: Number,
    marketerProfits: Number,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const InstructorProfitsSchema = new Schema<any>(
  {
    instructor: { type: Schema.Types.ObjectId, ref: 'User' },
    totalSalesMoney: { type: Number, default: 0 },
    profits: { type: Number, default: 0 },
    withdrawals: { type: Number, default: 0 },
    commissions: [instructorCommissionSchema],
    paymentMethod: String,
    receiverAcc: String,
    invoices: [
      {
        profits: Number,
        desc: String,
        status: invoiceStatus,
        createdAt: { type: Date, default: Date.now },
        paidAt: Date,
      },
    ],
  },
  { timestamps: true },
);

InstructorProfitsSchema.pre(/^find/, function (next) {
  this.populate({ path: 'commissions.marketer', select: 'name email profileImg' });
  next();
});

export const InvitationLinkAnalyticsSchema = new Schema<any>(
  {
    marketer: { type: Schema.Types.ObjectId, ref: 'User' },
    year: Number,
    month: Number,
    clicksDetails: [
      {
        invitationKey: String,
        clicks: Number,
      },
    ],
  },
  { timestamps: true },
);

export const MarketerRatingSchema = new Schema<any>(
  {
    rater: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'review must belong to user'] },
    marketer: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'review must belong to user'] },
    ratings: { type: Number, min: [1, 'min value is 1.0'], max: [5, 'max value is 5.0'] },
    comment: String,
  },
  { timestamps: true },
);

MarketerRatingSchema.pre(/^find/, function (next) {
  this.populate({ path: 'rater', select: 'name profileImg' });
  this.populate({ path: 'marketer', select: 'name profileImg' });
  next();
});

export const LeaderBoardSchema = new Schema<any>(
  {
    year: Number,
    month: Number,
    firstRank: {
      amount: Number,
      marketer: { type: Schema.Types.ObjectId, ref: 'User' },
      gotInAt: Date,
    },
    secondRank: {
      amount: Number,
      marketer: { type: Schema.Types.ObjectId, ref: 'User' },
      gotInAt: Date,
    },
    thirdRank: {
      amount: Number,
      marketer: { type: Schema.Types.ObjectId, ref: 'User' },
      gotInAt: Date,
    },
  },
  { timestamps: true, strict: false },
);

LeaderBoardSchema.pre(/^find/, function (next) {
  this.populate({ path: 'firstRank.marketer', select: 'name email profileImg' })
    .populate({ path: 'secondRank.marketer', select: 'name email profileImg' })
    .populate({ path: 'thirdRank.marketer', select: 'name email profileImg' });
  next();
});
