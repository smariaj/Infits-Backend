// socket.js
let io;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join", (email) => {
      console.log(`${email} joined room`);
      socket.join(email);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}

function emitCallUpdate(userEmail, callData) {
  if (!io) return;
  io.to(userEmail).emit("callUpdate", callData);
}

module.exports = { initSocket, emitCallUpdate };
