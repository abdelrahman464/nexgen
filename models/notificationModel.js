const mongoose = require('mongoose');
const { sendNotification } = require('../socket/index'); // Adjust the path as per your file structure
const User = require('./userModel');

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
    file: String, //add pdf path that have order details -> with {type = order ,type =certificate}
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
const setImageURL = (doc) => {
  //return image base url + iamge name
  const folder = doc.type === 'order' ? 'orders' : 'certificate';
  if (doc.file) {
    const fileUrl = `${process.env.BASE_URL}/${folder}/${doc.file}`;
    doc.file = fileUrl;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
NotificationSchema.post('init', (doc) => {
  setImageURL(doc);
});
// it work with create
NotificationSchema.post('save', (doc) => {
  setImageURL(doc);
});

NotificationSchema.post('save', async (doc) => {
  try {
    const user = await User.findById(doc.user).select('lang'); // Fetch user language
    if (!user) {
      console.error('User not found for notification:', doc.user);
      return;
    }
    const notificationTitle =
      user.lang === 'ar'
        ? doc.toObject().message.ar
        : doc.toObject().message.en;
    // Send localized notification
    sendNotification(doc.user.toString(), {
      ...doc.toObject(),
      message: notificationTitle,
    });
  } catch (error) {
    console.error('Error emitting notification:', error);
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
