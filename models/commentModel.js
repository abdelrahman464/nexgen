const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: { // if this comment is a reply to another comment
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    content: {
      type: String,
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    image: String,
  },
  { timestamps: true }
);

// ^find => it mean if part of of teh word contains find
CommentSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "user", select: "name profileImg" });
  next();
});

const setImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.image) {
    const imageUrl = `${process.env.BASE_URL}/commentPost/${doc.image}`;
    doc.image = imageUrl;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
CommentSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
CommentSchema.post("save", (doc) => {
  setImageURL(doc);
});
const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
module.exports = Comment;
