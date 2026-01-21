const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   DASHBOARD STATS (GLOBAL)
========================= */
router.get("/stats", async (req, res) => {
  try {
    const connection = await db.getConnection();

    // 1️⃣ Active campaigns
    const [[{ active_campaigns }]] = await connection.execute(
      `SELECT COUNT(*) AS active_campaigns FROM campaigns WHERE status = 'active'`
    );

    // 2️⃣ Calls today
    const [[{ calls_today }]] = await connection.execute(
      `SELECT COUNT(*) AS calls_today
       FROM call_stats
       WHERE DATE(timestamp) = CURDATE()`
    );

    // 3️⃣ Conversion rate
    const [[{ conversion_rate }]] = await connection.execute(
      `SELECT
        IF(SUM(total_calls) = 0, 0,
        ROUND(SUM(answered_calls)/SUM(total_calls)*100,2)) AS conversion_rate
       FROM (
         SELECT COUNT(*) AS total_calls,
                SUM(connected) AS answered_calls
         FROM call_stats
         GROUP BY campaign_id
       ) AS campaign_calls`
    );

    // 4️⃣ Available agents
    const [[{ available_agents }]] = await connection.execute(
      `SELECT COUNT(*) AS available_agents
       FROM users
       WHERE status = 'active'`
    );

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
    console.error("Dashboard stats error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ===============================
   DASHBOARD SUMMARY (AGENT)
=============================== */
router.get("/summary/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    // TEMP DATA (to be replaced with real lead queries)
    const [rows] = await db.query(`
      SELECT
        8  AS highPriorityLeads,
        2  AS todayHighPriority,
        42 AS freshLeads,
        15 AS contactedLeads
    `);

    res.json(rows[0]);
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

/* ===============================
   RECENT ACTIVITY (AGENT)
=============================== */
router.get("/recent-activity/:agentId", async (req, res) => {
  try {
    // TEMP STATIC DATA
    res.json([
      {
        name: "John Doe",
        status: "No answer • Added to callback list",
        time: "2m ago",
      },
      {
        name: "Sarah Smith",
        status: "Callback scheduled • Pricing Inquiry",
        time: "2:00 PM",
      },
      {
        name: "Rana",
        status: "Callback scheduled • Pricing Inquiry",
        time: "11:00 PM",
      },
    ]);
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({ error: "Failed to load activity" });
  }
});


/* =========================
   AGENT LIVE DASHBOARD
   (NEW - DOES NOT AFFECT OLD ROUTES)
========================= */
router.get("/agent-live/:agentId", async (req, res) => {
  const { agentId } = req.params;

  try {
    // 1️⃣ Lead counters
    const [[stats]] = await db.execute(
      `
      SELECT
        SUM(CASE WHEN status = 'Interested' THEN 1 ELSE 0 END) AS interestedLeads,
        SUM(CASE WHEN status = 'New Lead' THEN 1 ELSE 0 END) AS freshLeads,
        SUM(CASE WHEN status IN ('Interested','Call Back','Converted') THEN 1 ELSE 0 END) AS contactedLeads
      FROM leads
      WHERE assigned_agent_id = ?
      `,
      [agentId]
    );

    // 2️⃣ Recent activities (latest 3 leads for this agent)
    const [activities] = await db.execute(
      `
      SELECT
        name,
        status,
        created_at
      FROM leads
      WHERE assigned_agent_id = ?
      ORDER BY created_at DESC
      LIMIT 3
      `,
      [agentId]
    );

    res.json({
      success: true,
      data: {
        interestedLeads: stats.interestedLeads || 0,
        freshLeads: stats.freshLeads || 0,
        contactedLeads: stats.contactedLeads || 0,
        recentActivities: activities.map(a => ({
          name: a.name,
          status: a.status,
          time: a.created_at
        }))
      }
    });

  } catch (err) {
    console.error("AGENT LIVE DASHBOARD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load agent dashboard"
    });
  }
});



module.exports = router;
