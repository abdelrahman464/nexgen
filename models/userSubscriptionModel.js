const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
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
userSubscriptionSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'package',
    select: 'title course subscriptionDurationDays type',
  });
  next();
});
module.exports = mongoose.models.UserSubscription || mongoose.model('UserSubscription', userSubscriptionSchema);
