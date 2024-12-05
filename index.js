const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: [
    "https://confession-box.vercel.app",
    "https://confession-box-server.onrender.com",
  ],
  methods: ["GET", "POST"],
  credentials: true, // Allow credentials
};

const io = new Server(server, {
  cors: {
    origin: corsOptions, // Adjust this to allow requests only from your front-end origin
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

// Function to broadcast the list of connected users to all clients
const updatePartners = () => {
  const connectedUsers = Array.from(io.sockets.sockets.keys());
  io.emit("updatePartners", connectedUsers); // Emit the list of connected user IDs
};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Notify all clients about the updated list of users
  updatePartners();

  // Handle incoming calls
  socket.on("callUser", ({ userToCall, signalData }) => {
    console.log(`Call request from ${socket.id} to ${userToCall}`);
    io.to(userToCall).emit("callIncoming", {
      signal: signalData,
      from: socket.id,
    });
  });

  // Handle call acceptance
  socket.on("answerCall", ({ signal }) => {
    console.log(`Call accepted by ${socket.id}`);
    io.to(signal.from).emit("callAccepted", signal);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    updatePartners(); // Notify all clients about the updated list
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
