const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   LOG A NEW CALL
=============================== */
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      campaign_id,
      type,
      connected,
      duration
    } = req.body;

    // Basic validation
    if (!user_id || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user_id or type",
      });
    }

    // Logical defaults
    const isConnected = connected ? 1 : 0;
    const callDuration = duration ? Number(duration) : 0;

    const [result] = await db.execute(
      `
      INSERT INTO call_stats
        (user_id, campaign_id, type, connected, duration, timestamp)
      VALUES
        (?, ?, ?, ?, ?, NOW())
      `,
      [
        user_id,
        campaign_id || null,
        type,
        isConnected,
        callDuration,
      ]
    );

    res.json({
      success: true,
      message: "Call logged successfully",
      data: {
        callId: result.insertId,
      },
    });
  } catch (err) {
    console.error("Error logging call:", err);
    res.status(500).json({
      success: false,
      message: "Failed to log call",
    });
  }
});

module.exports = router;
