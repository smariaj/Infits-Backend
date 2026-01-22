const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   DASHBOARD STATS (GLOBAL)
========================= */
router.get("/stats", async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();

    // 1️⃣ Active campaigns
    const [[{ active_campaigns }]] = await connection.execute(`
      SELECT COUNT(*) AS active_campaigns
      FROM campaigns
      WHERE status = 'active'
    `);

    // 2️⃣ Calls today
    const [[{ calls_today }]] = await connection.execute(`
      SELECT COUNT(*) AS calls_today
      FROM call_stats
      WHERE DATE(timestamp) = CURDATE()
    `);

    // 3️⃣ Conversion rate (campaign-wise)
    const [[{ conversion_rate }]] = await connection.execute(`
      SELECT
        IF(SUM(total_calls) = 0, 0,
        ROUND(SUM(answered_calls) / SUM(total_calls) * 100, 2)) AS conversion_rate
      FROM (
        SELECT
          campaign_id,
          COUNT(*) AS total_calls,
          SUM(connected) AS answered_calls
        FROM call_stats
        GROUP BY campaign_id
      ) AS campaign_calls
    `);

    // 4️⃣ Available agents
    const [[{ available_agents }]] = await connection.execute(`
      SELECT COUNT(*) AS available_agents
      FROM users
      WHERE accepting_calls = true
    `);

    connection.release();

    res.json({
      success: true,
      data: {
        active_campaigns,
        calls_today,
        conversion_rate,
        available_agents,
      },
    });
  } catch (err) {
    if (connection) connection.release();
    console.error("Dashboard stats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard stats",
    });
  }
});

/* ===============================
   DASHBOARD SUMMARY (AGENT)
=============================== */
router.get("/summary/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const [[summary]] = await db.query(`
      SELECT
        COUNT(*) AS totalLeads,
        SUM(status = 'Interested') AS interestedLeads,
        SUM(status = 'Converted') AS convertedLeads,
        SUM(DATE(created_at) = CURDATE()) AS todayLeads
      FROM leads
      WHERE assigned_agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard summary",
    });
  }
});

/* ===============================
   RECENT ACTIVITY (AGENT)
=============================== */
router.get("/recent-activity/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const [activities] = await db.query(`
      SELECT
        l.name,
        la.title AS status,
        la.created_at AS time
      FROM lead_activities la
      JOIN leads l ON l.id = la.lead_id
      WHERE la.user = ?
      ORDER BY la.created_at DESC
      LIMIT 5
    `, [agentId]);

    res.json({
      success: true,
      data: activities
    });
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load recent activity",
    });
  }
});

module.exports = router;
