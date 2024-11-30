const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://confession-box.vercel.app", // Allow requests from your front-end
    methods: ["GET", "POST"],
  },
});

const availableUsers = new Set(); // Track users available for matching
const activePairs = new Map(); // Track active chat pairs

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Add the user to the available pool and attempt to match.
  availableUsers.add(socket.id);
  tryMatch();

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    availableUsers.delete(socket.id);

    // End chat if the user is in an active pair
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("chatEnded", {
          message: "Your partner has disconnected.",
        });
      }
      activePairs.delete(socket.id);
      activePairs.delete(partnerId);
    }
  });

  socket.on("next", () => {
    // End current chat and re-add user to the pool
    endCurrentChat(socket.id);
    availableUsers.add(socket.id);
    tryMatch();
  });

  socket.on("callUser", ({ userToCall, signalData }) => {
    const partnerSocket = io.sockets.sockets.get(userToCall);
    if (partnerSocket) {
      partnerSocket.emit("callUser", { signal: signalData });
    }
  });

  socket.on("answerCall", ({ signal }) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("callAccepted", signal);
      }
    }
  });

  socket.on("sendMessage", (message) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("receiveMessage", message);
      }
    }
  });
});

function tryMatch() {
  if (availableUsers.size >= 2) {
    const [user1, user2] = [...availableUsers].slice(0, 2);
    availableUsers.delete(user1);
    availableUsers.delete(user2);

    activePairs.set(user1, user2);
    activePairs.set(user2, user1);

    // Notify both users they are matched
    io.to(user1).emit("matched", { partnerId: user2 });
    io.to(user2).emit("matched", { partnerId: user1 });
  }
}

function endCurrentChat(userId) {
  const partnerId = activePairs.get(userId);
  if (partnerId) {
    activePairs.delete(userId);
    activePairs.delete(partnerId);

    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit("chatEnded", { message: "Your partner has left." });
    }
  }
}

// Start the server
const PORT = process.env.PORT || 6000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
