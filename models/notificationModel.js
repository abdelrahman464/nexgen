const mongoose = require('mongoose');
const { sendNotification } = require('../socket/index'); // Adjust the path as per your file structure

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: ['true', 'User required'],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    followedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: {
      type: String,
      required: [true, 'Message required'],
    },
    read: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['system', 'post', 'chat', 'certificate', 'follow'],
      default: 'system',
    },
  },
  { timestamps: true },
);
// ^find => it mean if part of of teh word contains find
NotificationSchema.pre(/^find/, function (next) {
  // this => query
  //this.populate({ path: "chat", select: "participants" });
  this.populate({
    path: 'post',
    select: 'content -user -package -course',
  }).populate({
    path: 'followedUser',
    select: 'name email profileImg',
  });
  next();
});

// // Emit a notification event after saving a new notification
NotificationSchema.post('save', async (doc) => {
  try {
    const userId = doc.user.toString();
    // Send notification to the user
    sendNotification(userId, doc);
  } catch (error) {
    console.error('Error emitting notification:', error);
    // Handle error as needed
  }
});
module.exports = mongoose.model('Notification', NotificationSchema);
