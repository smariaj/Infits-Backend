const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   DASHBOARD SUMMARY
=============================== */
router.get("/summary/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    // TEMP LOGIC (replace with real lead tables later)
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
   RECENT ACTIVITY
=============================== */
router.get("/recent-activity/:agentId", async (req, res) => {
  try {
    // TEMP STATIC DATA (will replace later)
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

module.exports = router;
