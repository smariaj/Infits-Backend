const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   GET LEAD ACTIVITIES
========================= */
router.get("/lead-activities", async (req, res) => {
  const { lead_id } = req.query;

  if (!lead_id) {
    return res.status(400).json({
      success: false,
      message: "lead_id is required",
    });
  }

  try {
    const [activities] = await db.execute(
      `
      SELECT id, lead_id, type, title, description, user, created_at
      FROM lead_activities
      WHERE lead_id = ?
      ORDER BY created_at DESC
      `,
      [lead_id]
    );

    res.json({
      success: true,
      data: activities,
    });
  } catch (err) {
    console.error("Fetch lead activities error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead activities",
    });
  }
});

/* =========================
   CREATE NEW ACTIVITY
========================= */
router.post("/lead-activities", async (req, res) => {
  const { lead_id, type, title, description, user } = req.body;

  if (!lead_id || !type || !title || !user) {
    return res.status(400).json({
      success: false,
      message: "lead_id, type, title, and user are required",
    });
  }

  if (!["call", "email", "note", "status"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid type. Must be call, email, note, or status",
    });
  }

  try {
    const [result] = await db.execute(
      `
      INSERT INTO lead_activities (lead_id, type, title, description, user)
      VALUES (?, ?, ?, ?, ?)
      `,
      [lead_id, type, title, description || null, user]
    );

    const [[activity]] = await db.execute(
      `
      SELECT id, lead_id, type, title, description, user, created_at
      FROM lead_activities
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: activity,
    });
  } catch (err) {
    console.error("Create lead activity error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create activity",
    });
  }
});
4


module.exports = router;
