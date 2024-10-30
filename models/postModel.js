const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sharedTo: {
      type: String,
      enum: ["home", "course", "package", "profile"],
      default: "home",
    },
    course: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    package: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Package",
      },
    ],
    imageCover: {
      type: String,
      required: [true, "post image cover is required"],
    },
    images: [String],
  },
  { timestamps: true }
);

// ^find => it mean if part of of teh word contains find
PostSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "user", select: "name profileImg" });
  this.populate({
    path: "course",
    select: "title -accessibleCourses -category",
  });
  this.populate({ path: "package", select: "title course" });
  next();
});

const setImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.imageCover) {
    const imageUrl = `${process.env.BASE_URL}/posts/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
  if (doc.images) {
    const imageListWithUrl = [];
    doc.images.forEach((image) => {
      const imageUrl = `${process.env.BASE_URL}/posts/${image}`;
      imageListWithUrl.push(imageUrl);
    });
    doc.images = imageListWithUrl;
  }
};

//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
PostSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
PostSchema.post("save", (doc) => {
  setImageURL(doc);
});
const Post = mongoose.model("Post", PostSchema);
module.exports = Post;
