import { Schema } from 'mongoose';

const addFileUrl = (value: string | undefined, folder: string) => {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${process.env.BASE_URL}/${folder}/${value}`;
};

const setPostUrls = (doc: any) => {
  if (!doc) return;
  doc.imageCover = addFileUrl(doc.imageCover, 'posts');
  if (Array.isArray(doc.images)) doc.images = doc.images.map((image: string) => addFileUrl(image, 'posts'));
  if (Array.isArray(doc.documents)) doc.documents = doc.documents.map((file: string) => addFileUrl(file, 'posts'));
};

const setFieldUrl = (doc: any, folder: string, field = 'image') => {
  if (doc?.[field]) doc[field] = addFileUrl(doc[field], folder);
};

export const PostSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    sharedTo: { type: String, enum: ['home', 'course', 'package', 'profile'], default: 'home' },
    course: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
    package: [{ type: Schema.Types.ObjectId, ref: 'Package' }],
    imageCover: { type: String, required: [true, 'post image cover is required'] },
    images: [String],
    documents: [String],
  },
  { timestamps: true },
);
PostSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' })
    .populate({ path: 'course', select: 'title -accessibleCourses -category' })
    .populate({ path: 'package', select: 'title course' });
  next();
});
PostSchema.post('init', setPostUrls);
PostSchema.post('save', setPostUrls);

export const CommentSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    content: { type: String, required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    image: String,
  },
  { timestamps: true },
);
CommentSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' });
  next();
});
CommentSchema.post('init', (doc) => setFieldUrl(doc, 'commentPost'));
CommentSchema.post('save', (doc) => setFieldUrl(doc, 'commentPost'));

export const ReactionSchema = new Schema<any>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  type: { type: String, enum: ['like', 'love', 'haha', 'sad', 'angry'], required: true },
});
ReactionSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImg' });
  next();
});

export const ChatSchema = new Schema<any>(
  {
    groupName: String,
    description: String,
    type: { type: String, enum: ['course', 'marketingTeam'] },
    creator: { type: Schema.Types.ObjectId, ref: 'User' },
    participants: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: ['true', 'User required'] },
        isAdmin: { type: Boolean, default: false },
      },
    ],
    image: String,
    isGroupChat: { type: Boolean, default: false },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ChatSchema.pre(/^find/, function (next) {
  this.populate({ path: 'participants.user', select: 'name profileImg email' })
    .populate({ path: 'creator', select: 'name profileImg email' })
    .populate({ path: 'pinnedMessages', select: 'text' })
    .populate({ path: 'course', select: 'title -accessibleCourses -category' });
  next();
});
ChatSchema.post('init', (doc) => setFieldUrl(doc, 'chats'));
ChatSchema.post('save', (doc) => setFieldUrl(doc, 'chats'));

export const MessageSchema = new Schema<any>(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    text: String,
    media: [String],
    isRead: { type: Boolean, default: false },
    seendBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
      },
    ],
    repliedTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true },
);
MessageSchema.pre(/^find/, function (next) {
  this.populate({ path: 'sender', select: 'name profileImg' }).populate({
    path: 'repliedTo',
    select: 'sender text media',
    populate: { path: 'sender', select: 'name profileImg' },
  });
  next();
});
MessageSchema.post('init', (doc) => {
  if (Array.isArray(doc?.media)) doc.media = doc.media.map((file: string) => addFileUrl(file, 'messages'));
});
MessageSchema.post('save', (doc) => {
  if (Array.isArray(doc?.media)) doc.media = doc.media.map((file: string) => addFileUrl(file, 'messages'));
});

export const LiveSchema = new Schema<any>(
  {
    instructor: { type: Schema.Types.ObjectId, ref: 'User' },
    creator: { type: Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true, i18n: true },
    date: { type: Date, required: [true, 'what is the date of the live will be ?'] },
    package: [{ type: Schema.Types.ObjectId, ref: 'Package' }],
    link: String,
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  },
  { timestamps: true },
);
LiveSchema.pre(/^find/, function (next) {
  this.populate({ path: 'package', select: 'title course' }).populate({ path: 'instructor', select: 'name email profileImg' });
  next();
});
