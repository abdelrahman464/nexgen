const generateCertificate = require("./generateCertificate");
const generateTimestampId = require("./randomId");
const CourseProgress = require("../models/courseProgressModel");
const UserSubscription = require("../models/userSubscriptionModel");
const Chat = require("../models/ChatModel");
const Notification = require("../models/notificationModel");

// exports.addCertificatesToUsers = async (req, res) => {
//   try {
//     const progresses = await CourseProgress.find({
//       score: { $gte: 90 },

//       "certificate.isDeserve": true,
//       "certificate.ID": { $exists: true },
//     })
//       .populate({ path: "course", select: "title" })
//       .populate({ path: "user", select: "name" });

//     return res.status(200).json({
//       status: "success",
//       length: progresses.length,
//       progresses,
//     });
//     progresses.map(async (progress) => {
//       const certificatePath = await generateCertificate(
//         progress.user.name,
//         progress.course.title.ar
//       );
//       await CourseProgress.findOneAndUpdate(
//         { user: progress.user._id, course: progress.course._id },
//         {
//           $set: {
//             "certificate.ID": generateTimestampId(),
//             "certificate.file": certificatePath,
//           },
//         }
//       );
//     });
//     // return res.status(200).json({
//     //   status: "success",
//     //   length: progresses.length,
//     //   progresses,
//     // });
//   } catch (err) {
//     console.log(err.message);
//   }
// };
//------------------------
exports.kickUnSubscribedUsers = async (req, res) => {
  const {
    user: { _id: userId, invitor },
  } = req;
  const now = new Date();
  const expiredSubscriptions = await UserSubscription.find({
    endDate: { $lt: now },
  });
  return res.json({expiredSubscriptions});
  //1-kick from chat
  expiredSubscriptions.map(async (doc) => {
    const chat = await Chat.findByIdAndUpdate(
      {
        $or: [
          { course: expiredSubscriptions.course._id },
          { creator: invitor },
        ],
      },
      { $pull: { participants: { user: userId } } },
      { new: true }
    );
    if (chat) {
      await Notification.create({
        user: userId,
        message: {
          en: `You have been removed from the group ${chat.groupName}`,
          ar: `تمت ازالتك من المجموعة ${chat.groupName}`,
        },
        type: "system",
      });
    }
  });
};
