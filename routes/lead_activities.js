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
      SELECT
        la.id,
        la.lead_id,
        la.type,
        la.title,
        la.description,
        u.name AS user,
        la.created_at
      FROM lead_activities la
      JOIN users u ON la.user_id = u.id
      WHERE la.lead_id = ?
      ORDER BY la.created_at DESC
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
  const { lead_id, type, title, description, user_id, user } = req.body;

  // Validate required fields
  if (!lead_id || !type || !title || !user_id || !user) {
    return res.status(400).json({
      success: false,
      message: "lead_id, type, title, user_id, and user are required",
    });
  }

  // Validate type
  if (!["call", "email", "note", "status"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid type. Must be call, email, note, or status",
    });
  }

  try {
    // Insert into lead_activities with user name
    const [result] = await db.execute(
      `
      INSERT INTO lead_activities (lead_id, type, title, description, user_id, user)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [lead_id, type, title, description || null, user_id, user]
    );

    // Fetch the newly created activity
    const [[activity]] = await db.execute(
      `
      SELECT
        la.id,
        la.lead_id,
        la.type,
        la.title,
        la.description,
        la.user,
        la.created_at
      FROM lead_activities la
      WHERE la.id = ?
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


module.exports = router;
