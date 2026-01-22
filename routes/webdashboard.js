const express = require("express");
const router = express.Router();
const db = require("../db");

/* =================================================
   WEB ADMIN DASHBOARD
   Route: GET /web/dashboard
================================================= */
router.get("/dashboard", async (req, res) => {
  try {
    // -------- SUMMARY --------
    const [[summary]] = await db.execute(`
      SELECT
        COUNT(*) AS totalCalls,
        SUM(connected = 1) AS connected,
        SUM(connected = 0) AS missedCalls,
        IFNULL(AVG(connected) * 3, 0) AS avgDuration
      FROM call_stats
      WHERE DATE(timestamp) = CURDATE()
    `);

    // -------- AGENT PERFORMANCE --------
    const [agents] = await db.execute(`
      SELECT
        u.id,
        u.name,
        COUNT(c.id) AS totalCalls,
        SUM(c.connected = 1) AS connected,
        SUM(c.connected = 0) AS missed,
        IFNULL(AVG(c.connected) * 3, 0) AS avgDuration,
        CASE
          WHEN u.accepting_calls = 1 THEN 'Active'
          ELSE 'Inactive'
        END AS status
      FROM users u
      LEFT JOIN call_stats c ON u.id = c.user_id
      WHERE u.role = 'agent'
      GROUP BY u.id, u.name, u.accepting_calls
    `);

    res.json({
      success: true,
      summary: {
        totalCalls: summary.totalCalls || 0,
        connected: summary.connected || 0,
        missedCalls: summary.missedCalls || 0,
        avgDuration: summary.avgDuration || 0,
      },
      agents,
    });
  } catch (err) {
    console.error("WEB DASHBOARD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load web dashboard",
    });
  }
});

module.exports = router;
