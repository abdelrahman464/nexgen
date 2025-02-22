const mongoose = require("mongoose");

const ArticalSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Article title required"],
      trim: true,
      minlength: 2,
      i18n: true,
    },
    description: {
      type: String,
      required: [true, "Article description required"],
      trim: true,
      minlength: 10,
      i18n: true,
    },
    content: {
      type: String,
      required: [true, "Article content required"],
      i18n: true,
    },
    date: {
      type: Date,
      default: new Date(),
    },
    videoUrl: String,
    imageCover: {
      type: String,
      required: true,
    },
    images: [String],

    readTime: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const setImageURL = (doc) => {
  if (doc.imageCover) {
    const imageUrl = `${process.env.BASE_URL}/blog/artical/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
};

ArticalSchema.post("init", (doc) => {
  setImageURL(doc);
});
ArticalSchema.post("save", (doc) => {
  setImageURL(doc);
});

ArticalSchema.pre(/^find/, function (next) {
  this.populate({ path: "author", select: "_id name email profileImg" });
  next();
});

module.exports = mongoose.model("Artical", ArticalSchema);
