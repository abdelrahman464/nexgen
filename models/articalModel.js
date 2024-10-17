const mongoose = require('mongoose');

const ArticalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title required'],
      trim: true,
      minlength: 2,
    },
    description: {
      type: String,
      required: [true, 'Article description required'],
      trim: true,
      minlength: 10,
    },
    content: {
      type: String,
      required: [true, 'Article content required'],
    },
    date: {
      type: Date,
      default: Date.now(),
    },
    videoUrl: String,
    imageCover: {
      type: String,
      required: true,
    },
    images: [String],
    author: {
      type: String,
      required: true,
    },
    readTime: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const setImageURL = (doc) => {
  if (doc.imageCover) {
    const imageUrl = `${process.env.BASE_URL}/blog/artical/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
};

ArticalSchema.post('init', (doc) => {
  setImageURL(doc);
});
ArticalSchema.post('save', (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model('Artical', ArticalSchema);
