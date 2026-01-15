const db = require("../db");

// ===============================
// CREATE template
// ===============================
async function createTemplate({ name, message, variables }) {
  const [result] = await db.query(
    `
    INSERT INTO message_templates (name, message, variables)
    VALUES (?, ?, ?)
    `,
    [name, message, JSON.stringify(variables)]
  );

  // Fetch inserted row
  const [rows] = await db.query(
    `SELECT * FROM message_templates WHERE id = ?`,
    [result.insertId]
  );

  return rows[0];
}

// ===============================
// GET all templates
// ===============================
async function getTemplates() {
  const [rows] = await db.query(
    `SELECT * FROM message_templates ORDER BY created_at DESC`
  );
  return rows;
}

// ===============================
// GET template by ID
// ===============================
async function getTemplateById(id) {
  const [rows] = await db.query(
    `SELECT * FROM message_templates WHERE id = ?`,
    [id]
  );
  return rows[0];
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
};
