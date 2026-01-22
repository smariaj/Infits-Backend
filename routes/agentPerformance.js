const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   AGENT DAILY PERFORMANCE
=============================== */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, campaignId } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    let query = `
      SELECT
        COUNT(*) AS totalCalls,
        SUM(connected = 1) AS connectedCalls,
        SUM(connected = 0) AS missedCalls,
        MIN(timestamp) AS firstCall,
        MAX(timestamp) AS lastCall,
        SUM(duration) AS totalDuration,
        ROUND(AVG(duration), 2) AS avgDuration
      FROM call_stats
      WHERE user_id = ?
        AND DATE(timestamp) = ?
    `;

    const params = [userId, date];

    // Optional campaign filter (logical & safe)
    if (campaignId) {
      query += " AND campaign_id = ?";
      params.push(campaignId);
    }

    const [rows] = await db.execute(query, params);

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error("Error fetching agent performance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent performance",
    });
  }
});

module.exports = router;
