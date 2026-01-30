const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const upload = multer({ dest: "uploads/tmp/" });

/* ================================
   GET CAMPAIGN LEADS (WEB)
   GET /web/campaigns/:id/leads
================================ */
router.get("/campaigns/:id/leads", async (req, res) => {
  const { id } = req.params;

  try {
    const [leads] = await db.query(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        u.name AS telecaller,
        DATE_FORMAT(l.created_at, '%b %d, %Y') AS lastActivity
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.campaign_id = ?
      ORDER BY l.created_at DESC
      `,
      [id]
    );

    res.json({ success: true, data: leads });
  } catch (err) {
    console.error("WEB CAMPAIGN LEADS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================================
   IMPORT LEADS (CSV)
   POST /web/campaigns/:id/leads/import
================================ */
router.post(
  "/campaigns/:id/leads/import",
  upload.single("file"),
  async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV required" });
    }

    const fs = require("fs");
    const csv = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path);

    const rows = csv.split("\n").slice(1);

    try {
      for (const row of rows) {
        if (!row.trim()) continue;

        const [name, company, phone, email, status] = row.split(",");

        await db.query(
          `
          INSERT INTO leads
          (campaign_id, name, company, phone, email, status)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [id, name, company, phone, email, status || "New Lead"]
        );
      }

      res.json({ success: true, message: "Leads imported" });
    } catch (err) {
      console.error("IMPORT LEADS ERROR:", err);
      res.status(500).json({ success: false });
    }
  }
);

module.exports = router;
