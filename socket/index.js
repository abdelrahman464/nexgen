const socketIO = require("socket.io");

let io;
let users = [];
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
    io.to(receiverSocketId).emit("receiveMessage", {
      senderId,
      text,
      private: true,
    });
  } else {
    socket.emit("errorMessage", "User not found or offline.");
  }
};

const sendGroupMessage = (socket, { senderId, roomId, payload, action }) => {
  socket.to(roomId).emit("receiveMessage", { senderId, payload, action });
};

const sendNotification = (userId, notificationData) => {
  const userSocketId = getUserSocketId(userId);
  if (userSocketId) {
    io.to(userSocketId).emit("notification", notificationData);
  } else {
    console.log(`User ${userId} is offline.`);
    // Optionally handle offline user case here
  }
};
function initSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: "*", // Allow all origins for now, adjust as needed
    },
  });

  io.on("connection", (socket) => {
    socket.on("addUser", ({ userId }) => {
      addUser(userId, socket.id);
      console.log(`User ${userId} connected`);
    });

    socket.on("joinRoom", ({ userId, roomId }) => {
      addUser(userId, socket.id, roomId);
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    socket.on("leaveRoom", ({ userId, roomId }) => {
      socket.leave(roomId);
      console.log(`User ${userId} left room ${roomId}`);
    });

    socket.on("sendMessage", (messageData) => {
      if (messageData.roomId) {
        sendGroupMessage(socket, messageData);
      } else {
        sendPrivateMessage(socket, messageData);
      }
    });

    socket.on("disconnect", () => {
      removeUser(socket.id);
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO server is running.");
  // Export sendNotification function
}

module.exports = {
  initSocket,
  sendNotification,
};
