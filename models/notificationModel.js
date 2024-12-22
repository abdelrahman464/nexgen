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
      type: mongoose.Schema.Types.ObjectId, // with {type =post}
      ref: 'Post',
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId, // with {type =chat}
      ref: 'Chat',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId, // with {type =certificate}
      ref: 'Course',
    },
    followedUser: {
      type: mongoose.Schema.Types.ObjectId, // with {type =follow}
      ref: 'User',
    },
    message: {
      type: String,
      required: [true, 'Message required'],
      i18n: true,
    },
    file: String, //add pdf path that have order details -> with {type = order }
    read: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['system', 'post', 'chat', 'certificate', 'follow', 'order'],
      default: 'system',
    },
  },
  { timestamps: true },
);
// ^find => it mean if part of of teh word contains find
NotificationSchema.pre(/^find/, function (next) {
  // this => query

  this.populate({
    path: 'post',
    select: 'content -user -package -course',
  })
    .populate({
      path: 'followedUser',
      select: 'name email profileImg',
    })
    .populate({
      path: 'chat',
      select: '-participants -course',
    });

  next();
});
const setCourseImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.file) {
    const fileUrl = `${process.env.BASE_URL}/orders/${doc.file}`;
    doc.file = fileUrl;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
NotificationSchema.post('init', (doc) => {
  setCourseImageURL(doc);
});
// it work with create
NotificationSchema.post('save', (doc) => {
  setCourseImageURL(doc);
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
