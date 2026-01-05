const express = require("express");
const router = express.Router();
const db = require("../db");


router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        id,
        name,
        phone,
        team,
        profile_image
      FROM users
      ORDER BY name
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Error fetching agents:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents",
    });
  }
});

module.exports = router;
