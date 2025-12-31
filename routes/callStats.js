const express = require("express");
const router = express.Router();

// TEMP: dummy middleware so server does not crash
const verifyToken = (req, res, next) => {
  next();
};

// GET stats
router.get("/", verifyToken, (req, res) => {
  res.json({ success: true, data: [] });
});

// POST new call
router.post("/log-call", verifyToken, (req, res) => {
  res.json({ success: true, message: "Call logged" });
});

module.exports = router;
