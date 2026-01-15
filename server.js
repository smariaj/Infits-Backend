const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const callRoutes = require("./routes/callStats");
const summaryRoutes = require("./routes/summary");
const agentRoutes = require("./routes/agents");
const campaignRoutes = require("./routes/campaigns");
const dashboardRoutes = require("./routes/dashboard");
const leadsRoutes = require("./routes/leads");
const leadActivitiesRouter = require("./routes/lead_activities");




const db = require("./db");

const path = require("path");

const app = express();
const server = http.createServer(app);

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =======================
   ROUTES (DO NOT CHANGE)
======================= */
app.use("/", authRoutes);
app.use("/users", userRoutes);
app.use("/call-stats", callRoutes);
app.use("/call-stats/summary", summaryRoutes);
app.use("/agents", agentRoutes);
app.use("/campaigns",campaignRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/leads",leadsRoutes)
app.use("/lead_activities", leadActivitiesRouter);

/* =======================
   SOCKET.IO (NO DB LOGIC)
======================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

/* =======================
   GLOBAL ERROR HANDLER
======================= */
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
