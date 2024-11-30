const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Allowed origin for CORS (Vercel front-end URL)
const allowedOrigins = ["https://confession-box.vercel.app"]; // Replace with your actual frontend URL

// Use CORS middleware to handle cross-origin requests
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true, // Allow credentials if needed
  })
);

const availableUsers = new Set(); // Set to track available users

// When a client connects
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Add the user to the available pool of users
  availableUsers.add(socket.id);

  // Attempt to match users for a video chat
  tryMatch();

  // Handle user disconnection
  socket.on("disconnect", () => {
    availableUsers.delete(socket.id);
    console.log(`User disconnected: ${socket.id}`);
    tryMatch(); // Re-attempt matching when a user disconnects
  });

  // Handle the "next" event when a user wants to move to the next chat
  socket.on("next", () => {
    endCurrentChat(socket.id); // End the current chat session
    availableUsers.add(socket.id); // Add the user back to the available pool
    tryMatch(); // Attempt to match users again
  });

  // Handle when one user is calling another
  socket.on("callUser", ({ userToCall, signalData }) => {
    console.log(`User ${socket.id} is calling ${userToCall}`);

    // Emit the signal data to the user being called
    io.to(userToCall).emit("callUser", {
      signal: signalData, // Send the signaling data to the user being called
      from: socket.id, // Identify the caller
    });
  });

  // Handle when a user answers a call
  socket.on("answerCall", (signalData) => {
    console.log(`User ${socket.id} is answering the call`);

    // Send the signal back to the user who initiated the call
    io.to(signalData.from).emit("callAccepted", signalData.signal);
  });

  // Handle sending messages between users
  socket.on("sendMessage", (message) => {
    console.log(`User ${socket.id} is sending a message: ${message}`);
    io.emit("receiveMessage", { text: message, fromSelf: socket.id });
  });
});

// Function to try and match users for a video chat
function tryMatch() {
  if (availableUsers.size >= 2) {
    const [user1, user2] = [...availableUsers].slice(0, 2);
    availableUsers.delete(user1);
    availableUsers.delete(user2);

    // Notify both users that they are matched
    io.to(user1).to(user2).emit("matched", { partnerId: user2 });
    console.log(`Users matched: ${user1} and ${user2}`);
  }
}

// Function to end the current chat session for a user
function endCurrentChat(userId) {
  console.log(`Ending chat for user: ${userId}`);
  availableUsers.delete(userId); // Remove user from the available pool
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
