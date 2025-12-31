const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();
const server = http.createServer(app);

// Allow CORS for your Flutter app
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/", authRoutes);

// In-memory call stats
let callStats = {
  firstCall: null,
  lastCall: null,
  allCalls: 0,
  connected: 0,
  in: 0,
  out: 0,
  missed: 0,
  dailyGoal: 0.0,
  remaining: 0,
};

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected");

  // Send initial stats
  socket.emit("update", callStats);

  // Listen for new calls
  socket.on("new-call", (call) => {
    const { type, connected, timestamp } = call;

    callStats.allCalls += 1;
    if (type === "in") callStats.in += 1;
    if (type === "out") callStats.out += 1;
    if (type === "missed") callStats.missed += 1;
    if (connected) callStats.connected += 1;

    if (!callStats.firstCall) callStats.firstCall = timestamp;
    callStats.lastCall = timestamp;

    callStats.dailyGoal = callStats.connected / (callStats.allCalls > 0 ? callStats.allCalls : 1);
    callStats.remaining = callStats.allCalls - callStats.connected;

    // Broadcast updated stats to all connected clients
    io.emit("update", callStats);
  });
});

const PORT = 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
