const express = require("express");
const router = express.Router();
const db = require("../db");

/*
  ADMIN WEB – AGENT PERFORMANCE
  Endpoint:
  GET /web/agent-performance?agentId=1&date=YYYY-MM-DD
*/

router.get("/agent-performance", async (req, res) => {
  const { agentId, date } = req.query;

  // ================= VALIDATION =================
  if (!agentId || !date) {
    return res.status(400).json({
      success: false,
      message: "agentId and date are required",
    });
  }

  try {
    // ================= AGENT VALIDATION =================
    const [agentRows] = await db.query(
      `
      SELECT id, name, team
      FROM users
      WHERE id = ? AND role = 'agent'
      `,
      [agentId]
    );

    if (agentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    const agent = agentRows[0];

    // ================= CALL SUMMARY =================
    const [summaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(connected = 1) AS connected,
        SUM(type = 'missed') AS missed
      FROM call_stats
      WHERE user_id = ?
      AND DATE(timestamp) = ?
      `,
      [agentId, date]
    );

    const summary = summaryRows[0] || {};

    // ================= TIME ACTIVITY =================
    const [timeRows] = await db.query(
      `
      SELECT
        DATE_FORMAT(MIN(timestamp), '%h:%i %p') AS firstCall,
        DATE_FORMAT(MAX(timestamp), '%h:%i %p') AS lastCall
      FROM call_stats
      WHERE user_id = ?
      AND DATE(timestamp) = ?
      `,
      [agentId, date]
    );

    const timeActivity = {
      totalDuration: "--",
      avgDuration: "--",
      firstCall: timeRows[0]?.firstCall || "--",
      lastCall: timeRows[0]?.lastCall || "--",
    };

    // ================= ACTIVITY LOGS =================
    const [logs] = await db.query(
  `
  SELECT
    l.id,
    l.name,
    l.company,
    l.phone,

    DATE_FORMAT(
      MAX(la.created_at),
      '%h:%i %p'
    ) AS time,

    COALESCE(
      MAX(la.title),
      'No Activity'
    ) AS status

  FROM leads l
  LEFT JOIN lead_activities la
    ON la.lead_id = l.id
    AND la.user_id = ?

  WHERE l.assigned_agent_id = ?

  GROUP BY l.id
  ORDER BY MAX(la.created_at) DESC
  LIMIT 5
`,
  [agentId, agentId]
);


    const formattedLogs = logs.map((log) => ({
      name: log.name,
      company: log.company,
      phone: log.phone,
      time: log.time,
      duration: "--",
      status: log.status,
    }));

    // ================= TOTAL LOG COUNT (PAGINATION) =================
    const [[countRow]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM lead_activities
      WHERE user_id = ?
      AND DATE(created_at) = ?
      `,
      [agentId, date]
    );

    // ================= RESPONSE =================
    res.json({
      success: true,
      agent,
      summary: {
        total: summary.total || 0,
        connected: summary.connected || 0,
        missed: summary.missed || 0,
      },
      timeActivity,
      logs: formattedLogs,
      pagination: {
        total: countRow.total || 0,
        page: 1,
        limit: 5,
      },
    });
  } catch (error) {
    console.error("Web Agent Performance Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
