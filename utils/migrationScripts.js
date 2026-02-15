const UserSubscription = require('../models/userSubscriptionModel');
const Chat = require('../models/ChatModel');
const Notification = require('../models/notificationModel');
const MarketLog = require('../models/MarketingModel');
const Order = require('../models/orderModel');

// exports.addCertificatesToUsers = async (req, res) => {
//   try {
//     const progresses = await CourseProgress.find({
//       score: { $gte: 90 },

//    
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
// exports.kickUnSubscribedUsers = async (req, res) => {
//   try {
//     const now = new Date();
//     const expiredSubscriptions = await UserSubscription.find({
//       endDate: { $lt: now },
//     })
//       .sort({ endDate: -1 })
//       .populate({
//         path: "user",
//         select: "invitor email",
//       });

//     let processedCount = 0;

//     // Use for...of instead of map for proper async handling
//     for (const doc of expiredSubscriptions) {
//       try {
//         const $or = [{ course: doc.package.course._id }];
//         if (doc.user?.invitor) {
//           $or.push({ creator: doc.user.invitor });
//         }
//         // First find chats that might contain this user
//         const chats = await Chat.find({
//           $or: $or,
//         });

//         // Process each chat separately
//         for (const chat of chats) {
//           // Check if user is actually in participants
//           const userIndex = chat.participants.findIndex(
//             (p) => p.user && p.user.toString() === doc.user._id.toString()
//           );

//           if (userIndex !== -1) {
//             // Remove the participant
//             chat.participants.splice(userIndex, 1);
//             await chat.save();

//             await Notification.create({
//               user: doc.user._id,
//               message: {
//                 en: `You have been removed from the group ${chat.groupName}`,
//                 ar: `تمت ازالتك من المجموعة ${chat.groupName}`,
//               },
//               type: "system",
//             });

//             processedCount++;
//             console.log(`Removed user ${doc.user._id} from chat ${chat._id}`);
//           }
//         }
//       } catch (err) {
//         console.error(`Error processing subscription ${doc._id}:`, err.message);
//       }
//     }

//     console.log("Migration completed. Processed:", processedCount);
//     return res.json({
//       status: "success",
//       message: `Processed ${processedCount} removals from chats`,
//     });
//   } catch (err) {
//     console.error("Error in kickUnSubscribedUsers:", err.message);
//     return res.status(500).json({
//       status: "fail",
//       message: err.message,
//     });
//   }
// };
exports.kickUnsubscribedUsersJob = async () => {
  try {
    const now = new Date();
    const expiredSubscriptions = await UserSubscription.find({
      endDate: { $lt: now },
    })
      .sort({ endDate: -1 })
      .populate({
        path: 'user',
        select: 'invitor email',
      });

    let processedCount = 0;

    for (const doc of expiredSubscriptions) {
      try {
        // Check if user exists
        if (!doc.user || !doc.user._id) {
          console.log(`No user found for subscription ${doc._id}`);
          continue;
        }
        if (!doc.package?.course?._id) {
          console.log(`No course found for subscription ${doc._id}`);
          continue;
        }

        const queryConditions = [{ course: doc.package.course._id }];

        if (doc.user?.invitor) {
          queryConditions.push({ creator: doc.user.invitor });
        }

        const chats = await Chat.find({
          $or: queryConditions,
          'participants.user': doc.user._id,
        });

        for (const chat of chats) {
          // Check if the user is an admin in this chat
          const userParticipant = chat.participants.find((participant) => {
            return (
              participant.user &&
              participant.user._id.toString() === doc.user._id.toString()
            );
          });
          // Only kick the user if they are not an admin
          if (userParticipant && !userParticipant.isAdmin) {
            const result = await Chat.updateOne(
              { _id: chat._id },
              { $pull: { participants: { user: doc.user._id } } },
            );

            if (result.modifiedCount > 0) {
              await Notification.create({
                user: doc.user._id,
                message: {
                  en: `You have been removed from the group ${chat.groupName}`,
                  ar: `تمت ازالتك من المجموعة ${chat.groupName}`,
                },
                type: 'system',
              });

              processedCount++;
              console.log(`Removed user ${doc.user._id} from chat ${chat._id}`);
            }
          } else {
            console.log(
              `Skipped admin user ${doc.user._id} from chat ${chat._id}`,
            );
          }
        }
      } catch (err) {
        console.error(`Error processing subscription ${doc._id}:`, err);
      }
    }

    console.log('Cron job completed. Processed:', processedCount);
    return { success: true, processedCount };
  } catch (err) {
    console.error('Error in kickUnsubscribedUsersJob:', err);
    throw err;
  }
};

// Keep your existing Express route handler
exports.kickUnSubscribedUsers = async (req, res) => {
  try {
    const result = await this.kickUnsubscribedUsersJob();
    return res.json({
      status: 'success',
      message: `Processed ${result.processedCount} removals from chats`,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'fail',
      message: err.message,
    });
  }
};

// Revert function: Re-add users with expired subscriptions back to their chats
// This reverses the effect of kickUnsubscribedUsersJob
exports.reAddUnsubscribedUsersToChats = async (req, res) => {
  try {
    const now = new Date();
    // Find all expired subscriptions (same criteria as kickUnsubscribedUsersJob)
    const expiredSubscriptions = await UserSubscription.find({
      endDate: { $gt: now },
    })
      .sort({ endDate: -1 })
      .populate({
        path: 'user',
        select: 'invitor email',
      })

    let processedCount = 0;
    let skippedCount = 0;
    // console.log(expiredSubscriptions[0]);
    // put here
    for (const doc of expiredSubscriptions) {
      try {
        // Check if user exists
        if (!doc.user || !doc.user._id) {
          console.log(`No user found for subscription ${doc._id}`);
          skippedCount++;
          continue;
        }
        if (!doc.package?.course?._id) {
          console.log(`No course found for subscription ${doc._id}`);
          skippedCount++;
          continue;
        }

        // Build query conditions to find chats (same logic as kick function)
        const queryConditions = [{ course: doc.package.course._id }];

        if (doc.user?.invitor) {
          queryConditions.push({ creator: doc.user.invitor });
        }

        // Find chats that the user should be in
        const chats = await Chat.find({
          $or: queryConditions,
        });

        for (const chat of chats) {
          // Check if user is already a participant
          const userParticipant = chat.participants.find((participant) => {
            return (
              participant.user &&
              participant.user.toString() === doc.user._id.toString()
            );
          });
          console.log(userParticipant);
          // If user is not in the chat, add them back
          if (!userParticipant) {
            const result = await Chat.updateOne(
              { _id: chat._id },
              {
                $addToSet: {
                  participants: {
                    user: doc.user._id,
                    isAdmin: false, // Re-add as regular participant (not admin)
                  },
                },
              }
            );

            // if (result.modifiedCount > 0) {
            //   await Notification.create({
            //     user: doc.user._id,
            //     message: {
            //       en: `You have been re-added to the group ${chat.groupName}`,
            //       ar: `تمت إعادة إضافتك إلى المجموعة ${chat.groupName}`,
            //     },
            //     chat: chat._id,
            //     type: 'chat',
            //   });

            //   processedCount++;
            //   console.log(
            //     `Re-added user ${doc.user._id} to chat ${chat._id} (${chat.groupName})`
            //   );
            // }
          } else {
            console.log(
              `User ${doc.user._id} already in chat ${chat._id}, skipping`
            );
          }
        }
      } catch (err) {
        console.error(`Error processing subscription ${doc._id}:`, err);
        skippedCount++;
      }
    }
    console.log(
      `Re-add job completed. Re-added: ${processedCount}, Skipped: ${skippedCount}`
    );
    return res.json({
      status: 'success',
      message: `Re-added ${processedCount} users to chats, skipped ${skippedCount}`,
      stats: {
        processed: processedCount,
        skipped: skippedCount,
        totalSubscriptions: expiredSubscriptions.length,
      },
    });
  } catch (err) {
    console.error('Error in reAddUnsubscribedUsersToChats:', err);
    return res.status(500).json({
      status: 'fail',
      message: err.message,
    });
  }
};
//=================
// Migration script to update orders with marketerId from MarketLog
exports.updateOrdersWithMarketerId = async (req, res) => {
  try {
    // 1. Find MarketLogs where sales array is not empty
    const marketLogs = await MarketLog.find({
      'sales.0': { $exists: true }, // Sales array has at least one element
    });

    if (marketLogs.length === 0) {
      console.log('No MarketLogs with sales found.');
      return;
    }

    // 2. Process each MarketLog
    for (const log of marketLogs) {
      const { marketer, sales } = log;

      if (!marketer || !sales || sales.length === 0) continue;

      // 3. Extract all orderIds from sales
      const orderIds = sales.map((sale) => sale.order);

      if (orderIds.length === 0) {
        console.log(`No valid orderIds found for MarketLog ${log._id}`);
        continue;
      }

      // 4. Update orders with marketerId
      const result = await Order.updateMany(
        { _id: { $in: orderIds } },
        { $set: { marketer } },
      );

      console.log(
        `Updated ${result.modifiedCount} orders for MarketLog ${log._id} with marketerId ${marketer}`,
      );
    }

    console.log('Script completed successfully.');
    return res.json({ msg: 'Orders updated successfully.' });
  } catch (error) {
    console.error('Error:', error);
  }
};

// Migration script to remove duplicate user subscriptions
// Keeps only the most recent subscription for each user-package combination
exports.removeDuplicateUserSubscriptions = async (req, res) => {
  try {
    console.log('Starting duplicate user subscription cleanup...');

    // Find all subscriptions grouped by user and package
    const duplicates = await UserSubscription.aggregate([
      {
        $group: {
          _id: {
            user: '$user',
            package: '$package',
          },
          subscriptions: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 }, // Only groups with duplicates
        },
      },
    ]);

    if (duplicates.length === 0) {
      console.log('No duplicate subscriptions found.');
      return res.json({
        status: 'success',
        message: 'No duplicate subscriptions found.',
        stats: {
          duplicateGroups: 0,
          totalDuplicates: 0,
          deleted: 0,
          kept: 0,
        },
      });
    }

    let totalDeleted = 0;
    let totalKept = 0;
    const deletePromises = [];

    // Process each duplicate group
    for (const group of duplicates) {
      const { subscriptions } = group;

      // Sort by _id (which contains timestamp) to get most recent first
      // MongoDB ObjectIds are sortable and contain creation timestamp
      subscriptions.sort((a, b) => {
        // Compare ObjectIds - newer ones are "greater"
        return b._id.toString().localeCompare(a._id.toString());
      });

      // Keep the first one (most recent), delete the rest
      const toKeep = subscriptions[0];
      const toDelete = subscriptions.slice(1);

      totalKept += 1;
      totalDeleted += toDelete.length;

      // Delete older duplicates
      const idsToDelete = toDelete.map((sub) => sub._id);
      deletePromises.push(
        UserSubscription.deleteMany({
          _id: { $in: idsToDelete },
        })
      );

      console.log(
        `User ${group._id.user} - Package ${group._id.package}: Keeping ${toKeep._id}, deleting ${idsToDelete.length} duplicates`
      );
    }

    // Execute all deletions in parallel
    await Promise.all(deletePromises);

    const stats = {
      duplicateGroups: duplicates.length,
      totalDuplicates: totalDeleted + totalKept,
      deleted: totalDeleted,
      kept: totalKept,
    };

    console.log('Duplicate cleanup completed:', stats);

    return res.json({
      status: 'success',
      message: `Removed ${totalDeleted} duplicate subscriptions, kept ${totalKept} most recent ones.`,
      stats,
    });
  } catch (error) {
    console.error('Error in removeDuplicateUserSubscriptions:', error);
    return res.status(500).json({
      status: 'fail',
      message: error.message,
    });
  }
};