const express = require("express");
const router = express.Router();
const db = require("../db");

/* =================================================
   GET LEAD DETAILS + ACTIVITIES
   GET /web/leads/:id/activity
================================================= */
router.get("/leads/:id/activity", async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Lead info
    const [[lead]] = await db.query(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        l.last_activity,
        u.name AS telecaller
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.id = ?
      `,
      [id]
    );

    if (!lead) {
      return res.status(404).json({ success: false });
    }

    // 2️⃣ Activities (JOIN users 🔥)
    const [activities] = await db.query(
      `
      SELECT
        la.id,
        la.type,
        la.title,
        la.description,
        la.created_at,
        u.id   AS user_id,
        u.name AS user_name,
        u.role AS user_role
      FROM lead_activities la
      JOIN users u ON u.id = la.user_id
      WHERE la.lead_id = ?
      ORDER BY la.created_at DESC
      `,
      [id]
    );

    res.json({
      success: true,
      data: {
        lead,
        activities,
      },
    });
  } catch (err) {
    console.error("WEB LEAD ACTIVITY ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =================================================
   ADD LEAD ACTIVITY
   POST /web/leads/:id/activity
================================================= */
router.post("/leads/:id/activity", async (req, res) => {
  const { id } = req.params;
  const { type, title, description, user_id } = req.body;

  if (!type || !title || !user_id) {
    return res.status(400).json({
      success: false,
      message: "Invalid activity data",
    });
  }

  try {
    await db.query(
      `
      INSERT INTO lead_activities
      (lead_id, user_id, type, title, description)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, user_id, type, title, description || null]
    );

    res.json({
      success: true,
      message: "Activity added",
    });
  } catch (err) {
    console.error("ADD ACTIVITY ERROR:", err);
    res.status(500).json({ success: false });
  }
});


module.exports = router;
