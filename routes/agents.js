const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   GET AGENTS
=============================== */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, name, phone, team, profile_image
      FROM users
      ORDER BY name
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ===============================
   GET CALL STATUS
=============================== */
router.get("/:id/call-status", async (req, res) => {
  const [rows] = await db.query(
    "SELECT accepting_calls FROM users WHERE id = ?",
    [req.params.id]
  );

  res.json({ acceptingCalls: rows[0]?.accepting_calls ?? true });
});

/* ===============================
   UPDATE CALL STATUS
=============================== */
router.put("/:id/call-status", async (req, res) => {
  const { acceptingCalls } = req.body;

  await db.query(
    "UPDATE users SET accepting_calls = ? WHERE id = ?",
    [acceptingCalls, req.params.id]
  );

  res.json({ success: true });
});

module.exports = router;
