const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   DASHBOARD STATS
========================= */
router.get("/stats", async (req, res) => {
  try {
    const connection = await db.getConnection();

    // 1️⃣ Active campaigns
    const [[{ active_campaigns }]] = await connection.execute(
      `SELECT COUNT(*) AS active_campaigns FROM campaigns WHERE status = 'active'`
    );

    // 2️⃣ Calls today (using timestamp column)
    const [[{ calls_today }]] = await connection.execute(
      `SELECT COUNT(*) AS calls_today
       FROM call_stats
       WHERE DATE(timestamp) = CURDATE()`
    );

    // 3️⃣ Conversion rate (answered / total)
    const [[{ conversion_rate }]] = await connection.execute(
      `SELECT
        IF(SUM(total_calls) = 0, 0, ROUND(SUM(answered_calls)/SUM(total_calls)*100,2)) AS conversion_rate
       FROM (
         SELECT COUNT(*) AS total_calls,
                SUM(connected) AS answered_calls
         FROM call_stats
         GROUP BY campaign_id
       ) AS campaign_calls`
    );

    // 4️⃣ Available agents (all agents with role = 'agent' and active status)
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
      message: err.message, // send actual DB error for debugging
    });
  }
});

module.exports = router;
