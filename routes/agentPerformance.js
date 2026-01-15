const express = require("express");
const router = express.Router();
const db = require("../db");

// GET agent daily stats
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const [rows] = await db.execute(
      `
      SELECT
        COUNT(*) AS totalCalls,
        SUM(connected = 1) AS connectedCalls,
        SUM(connected = 0) AS missedCalls,
        MIN(timestamp) AS firstCall,
        MAX(timestamp) AS lastCall,
        SUM(duration) AS totalDuration,
        AVG(duration) AS avgDuration
      FROM call_stats
      WHERE user_id = ?
      AND DATE(timestamp) = ?
      `,
      [userId, date]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching agent stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
