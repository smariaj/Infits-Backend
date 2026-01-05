const express = require("express");
const router = express.Router();
const db = require("../db");

// POST log a new call
router.post("/", async (req, res) => {
  try {
    const { user_id, campaign_id, type, connected, duration } = req.body;

    if (!user_id || !type) {
      return res
        .status(400)
        .json({ error: "Missing required fields: user_id or type" });
    }

    const [result] = await db.execute(
      `INSERT INTO call_stats (user_id, campaign_id, type, connected, duration, timestamp)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [user_id, campaign_id || null, type, connected ? 1 : 0, duration || 0]
    );

    res.json({ success: true, insertedId: result.insertId });
  } catch (err) {
    console.error("Error logging call:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
