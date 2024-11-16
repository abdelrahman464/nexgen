const socketIO = require('socket.io');
const UserModel = require('../models/userModel');

let io;
let users = [];
const userSessions = {}; // Track user session start times

const getUserSocketId = (userId) => {
  const user = users.find((user) => user.userId === userId);
  return user ? user.socketId : null;
};

// Add functions for managing users and messages
const addUser = (userId, socketId, roomId = null) => {
  const user = users.find((user) => user.userId === userId);
  if (user) {
    user.socketId = socketId;
    user.roomId = roomId; // Update the room ID if the user rejoins or changes rooms
  } else {
    users.push({ userId, socketId, roomId });
  }
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const sendPrivateMessage = (socket, { senderId, receiverId, text }) => {
  const receiverSocketId = getUserSocketId(receiverId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('receiveMessage', {
      senderId,
      text,
      private: true,
    });
  } else {
    socket.emit('errorMessage', 'User not found or offline.');
  }
};

const sendGroupMessage = (socket, { senderId, roomId, payload, action }) => {
  socket.to(roomId).emit('receiveMessage', { senderId, payload, action });
};

const sendNotification = (userId, notificationData) => {
  const userSocketId = getUserSocketId(userId);
  if (userSocketId) {
    io.to(userSocketId).emit('notification', notificationData);
  } else {
    console.log(`User ${userId} is offline.`);
    // Optionally handle offline user case here
  }
};
function initSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: '*', // Allow all origins for now, adjust as needed
    },
  });

  io.on('connection', (socket) => {
    // socket.on("addUser", ({ userId }) => {
    //   addUser(userId, socket.id);
    //   console.log(`User ${userId} connected`);
    // });

    socket.on('addUser', async ({ userId }) => {
      addUser(userId, socket.id);
      console.log(`User ${userId} connected`);

      // Record the login time
      userSessions[userId] = Date.now();

      try {
        // Update the lastLogin field
        const user = await UserModel.findByIdAndUpdate(
          userId,
          { 'timeSpent.lastLogin': new Date() },
          { new: true },
        );

        if (user && !user.timeSpent.monthlyStartDate) {
          // Initialize monthlyStartDate if not already set
          await UserModel.findByIdAndUpdate(
            userId,
            { 'timeSpent.monthlyStartDate': new Date() },
            { new: true },
          );
        }
      } catch (error) {
        console.error(`Error updating user data for userId ${userId}:`, error);
      }
    });

    socket.on('joinRoom', ({ userId, roomId }) => {
      addUser(userId, socket.id, roomId);
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    socket.on('leaveRoom', ({ userId, roomId }) => {
      socket.leave(roomId);
      console.log(`User ${userId} left room ${roomId}`);
    });

    socket.on('sendMessage', (messageData) => {
      if (messageData.roomId) {
        sendGroupMessage(socket, messageData);
      } else {
        sendPrivateMessage(socket, messageData);
      }
    });

    // socket.on("disconnect", () => {
    //   removeUser(socket.id);
    //   console.log(`User disconnected: ${socket.id}`);
    // });
    socket.on('disconnect', async () => {
      const disconnectedUser = users.find(
        (user) => user.socketId === socket.id,
      );
      if (disconnectedUser) {
        const { userId } = disconnectedUser;
        const sessionStart = userSessions[userId];
        if (sessionStart) {
          const sessionDuration = Math.floor(
            (Date.now() - sessionStart) / 1000,
          ); // Duration in seconds

          try {
            // Fetch the user to determine the monthly start date
            const user = await UserModel.findById(userId);

            if (user) {
              const now = new Date();
              let { monthlyStartDate, monthlyTimeSpent } = user.timeSpent;

              if (!monthlyStartDate) {
                // Initialize monthlyStartDate if not set
                monthlyStartDate = now;
                monthlyTimeSpent = 0;
              } else {
                monthlyStartDate = new Date(monthlyStartDate);
              }

              // Check if the session falls within the current 30-day period
              const daysDifference = Math.floor(
                (now - monthlyStartDate) / (1000 * 60 * 60 * 24),
              );

              if (daysDifference >= 1) {
                // Reset monthly time and start a new 30-day period
                monthlyTimeSpent = sessionDuration; // Only the current session duration
                monthlyStartDate = now;
              } else {
                // Add the session duration to the current monthly time
                monthlyTimeSpent += sessionDuration;
              }

              // Update the user document in a single query
              await UserModel.findByIdAndUpdate(
                userId,
                {
                  $set: {
                    'timeSpent.monthlyStartDate': monthlyStartDate,
                    'timeSpent.monthlyTimeSpent': monthlyTimeSpent,
                  },
                  $inc: { 'timeSpent.totalTimeSpent': sessionDuration },
                },
                { new: true }, // Return the updated document if needed
              );
            }
          } catch (error) {
            console.error(
              `Error updating user time for userId ${userId}:`,
              error,
            );
          }

          // Remove the session from memory
          delete userSessions[userId];
        }

        removeUser(socket.id);
        console.log(`User disconnected: ${userId}`);
      }
    });
  });

  console.log('Socket.IO server is running.');
}
// Export sendNotification function

module.exports = {
  initSocket,
  sendNotification,
};
