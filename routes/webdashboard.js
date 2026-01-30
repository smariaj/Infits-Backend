const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /web/dashboard
router.get("/", async (req, res) => {
  try {
    // =========================
    // SUMMARY (TODAY)
    // =========================
    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN connected = true THEN 1 ELSE 0 END) AS connected,
        SUM(CASE WHEN type = 'missed' THEN 1 ELSE 0 END) AS missedCalls
      FROM call_stats
      WHERE DATE(timestamp) = CURDATE()
    `);

    const summary = summaryRows[0];

    // =========================
    // AGENT PERFORMANCE
    // =========================
    const [agentRows] = await db.query(`
      SELECT
        u.id,
        u.name,
        u.accepting_calls,
        COUNT(cs.id) AS totalCalls,
        SUM(CASE WHEN cs.connected = true THEN 1 ELSE 0 END) AS connected,
        SUM(CASE WHEN cs.type = 'missed' THEN 1 ELSE 0 END) AS missed
      FROM users u
      LEFT JOIN call_stats cs
        ON cs.user_id = u.id
        AND DATE(cs.timestamp) = CURDATE()
      WHERE u.role = 'agent'
      GROUP BY u.id
      ORDER BY u.name
    `);

    const agents = agentRows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.accepting_calls ? "Online" : "Offline",
      totalCalls: a.totalCalls || 0,
      connected: a.connected || 0,
      missed: a.missed || 0,
    }));

    res.json({
      success: true,
      summary,
      agents,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Dashboard data fetch failed",
    });
  }
});

module.exports = router;
