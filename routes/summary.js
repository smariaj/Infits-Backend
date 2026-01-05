const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL connection

router.get('/', async (req, res) => {
  try {
    const [overall] = await db.execute(`
      SELECT
        COUNT(*) AS totalCalls,
        SUM(connected) AS connected,
        SUM(CASE WHEN type='missed' THEN 1 ELSE 0 END) AS missedCalls,
        IFNULL(AVG(duration), 0) AS avgDuration
      FROM call_stats
    `);

    const [agents] = await db.execute(`
      SELECT u.id, u.name,
        COUNT(cs.id) AS totalCalls,
        SUM(cs.connected) AS connected,
        SUM(CASE WHEN cs.type='missed' THEN 1 ELSE 0 END) AS missed,
        IFNULL(AVG(cs.duration), 0) AS avgDuration
      FROM users u
      LEFT JOIN call_stats cs ON u.id = cs.user_id
      GROUP BY u.id
    `);

    res.json({
      totalCalls: overall[0].totalCalls,
      connected: overall[0].connected,
      missedCalls: overall[0].missedCalls,
      avgDuration: overall[0].avgDuration,
      agents: agents
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------- Export router --------------------
module.exports = router;
