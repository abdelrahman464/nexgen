const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  type: {
    type: String,
    enum: ["like", "love", "haha", "sad", "angry"],
    required: true,
  },
});
// ^find => it mean if part of of teh word contains find
ReactionSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "user", select: "name profileImg" });
  next();
});
module.exports = mongoose.models.Reaction || mongoose.model("Reaction", ReactionSchema);
