const mongoose = require("mongoose");
const { sendNotification } = require("../socket/index"); // Adjust the path as per your file structure

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: ["true", "User required"],
    },
    message: {
      type: String,
      required: [true, "Message required"],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
    read: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["system", "post", "chat"],
      default: "system",
    },
  },
  { timestamps: true }
);
// ^find => it mean if part of of teh word contains find
NotificationSchema.pre(/^find/, function (next) {
  // this => query
  //this.populate({ path: "chat", select: "participants" });
  this.populate({ path: "post", select: "content -user -package -course" });
  next();
});

// // Emit a notification event after saving a new notification
NotificationSchema.post("save", async (doc) => {
  try {
    const userId = doc.user.toString();
    // Send notification to the user
    sendNotification(userId, doc);
  } catch (error) {
    console.error("Error emitting notification:", error);
    // Handle error as needed
  }
});
module.exports = mongoose.model("Notification", NotificationSchema);
