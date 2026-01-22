const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   CALL SUMMARY (GLOBAL + AGENTS)
=============================== */
router.get("/", async (req, res) => {
  try {
    /* ---------- OVERALL STATS ---------- */
    const [overall] = await db.execute(`
      SELECT
        COUNT(*) AS totalCalls,
        SUM(connected = 1) AS connectedCalls,
        SUM(type = 'missed') AS missedCalls,
        IFNULL(ROUND(AVG(duration), 2), 0) AS avgDuration
      FROM call_stats
    `);

    /* ---------- AGENT-WISE STATS ---------- */
    const [agents] = await db.execute(`
      SELECT
        u.id,
        u.name,
        COUNT(cs.id) AS totalCalls,
        SUM(cs.connected = 1) AS connectedCalls,
        SUM(cs.type = 'missed') AS missedCalls,
        IFNULL(ROUND(AVG(cs.duration), 2), 0) AS avgDuration
      FROM users u
      LEFT JOIN call_stats cs
        ON u.id = cs.user_id
      GROUP BY u.id, u.name
    `);

    res.json({
      success: true,
      data: {
        totalCalls: overall[0].totalCalls,
        connectedCalls: overall[0].connectedCalls,
        missedCalls: overall[0].missedCalls,
        avgDuration: overall[0].avgDuration,
        agents: agents,
      },
    });
  } catch (err) {
    console.error("Call summary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load call summary",
    });
  }
});

module.exports = router;
