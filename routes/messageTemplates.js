const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===============================
   CREATE MESSAGE TEMPLATE
=============================== */
router.post("/", async (req, res) => {
  try {
    const { name, message, variables } = req.body;

    if (!name || !message) {
      return res.status(400).json({ error: "name and message are required" });
    }

    const [result] = await db.query(
      `
      INSERT INTO message_templates (name, message, variables)
      VALUES (?, ?, ?)
      `,
      [name, message, JSON.stringify(variables || [])]
    );

    const [rows] = await db.query(
      `SELECT * FROM message_templates WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create template error:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

/* ===============================
   GET ALL TEMPLATES
=============================== */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM message_templates ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Get templates error:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

/* ===============================
   GENERATE MESSAGE LINKS
=============================== */
router.post("/send", async (req, res) => {
  try {
    const { templateId, phoneNumber, email, subject, values } = req.body;

    if (!templateId || !Array.isArray(values)) {
      return res.status(400).json({
        error: "templateId and values[] are required",
      });
    }

    /* -------------------------------
       1. Fetch template
    -------------------------------- */
    const [rows] = await db.query(
      `SELECT * FROM message_templates WHERE id = ?`,
      [templateId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const template = rows[0];

    /* -------------------------------
       2. Replace variables
    -------------------------------- */
    let variables = template.variables;
    if (typeof variables === "string") {
      variables = JSON.parse(variables);
    }

    let finalMessage = template.message;

    variables.forEach((key, index) => {
      finalMessage = finalMessage.replace(
        `{{${key}}}`,
        values[index] || ""
      );
    });

    const encodedMessage = encodeURIComponent(finalMessage);

    /* -------------------------------
       3. Generate redirect links
    -------------------------------- */
    let whatsappUrl = null;
    if (phoneNumber) {
      whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    }

    let gmailUrl = null;
    if (email) {
      gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(
        email
      )}&su=${encodeURIComponent(subject || "Message")}&body=${encodedMessage}`;
    }

    /* -------------------------------
       4. Response
    -------------------------------- */
    res.json({
      success: true,
      message: finalMessage,
      whatsappUrl,
      gmailUrl,
    });
  } catch (err) {
    console.error("Generate message error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate message links",
    });
  }
});

module.exports = router;
