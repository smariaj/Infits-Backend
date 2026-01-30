const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const upload = require("../middleware/upload");

/* =================================================
   ADD USER (WEB ADMIN)
   POST /web/users
================================================= */
router.post(
  "/users",
  upload.single("profile_image"),
  async (req, res) => {
    console.log("====== CREATE USER API HIT ======");
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);
    try {

      const {
        name,
        email,
        phone,
        password,
        role,
        team,
        date_of_joining,
      } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email and password are required",
        });
      }

      const [existing] = await db.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const profileImagePath = req.file
        ? `/uploads/profiles/${req.file.filename}`
        : null;

      await db.query(
        `
        INSERT INTO users
        (name, email, phone, password, role, team, date_of_joining, profile_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          name,
          email,
          phone || null,
          hashedPassword,
          role || "agent",
          team || null,
          date_of_joining || null,
          profileImagePath,
        ]
      );

      res.json({
        success: true,
        message: "User added successfully",
      });
    } catch (err) {
      console.error("WEB ADD USER ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

/* =================================================
   GET TEAM MEMBERS + STATS (WEB)
   GET /web/users
================================================= */
router.get("/users", async (req, res) => {
  try {
    const { search, role, status } = req.query;

    let conditions = [];
    let values = [];

    if (search) {
      conditions.push("(name LIKE ? OR email LIKE ?)");
      values.push(`%${search}%`, `%${search}%`);
    }

    if (role && role !== "All Roles") {
      conditions.push("role = ?");
      values.push(role);
    }

    if (status) {
      if (status === "Active") conditions.push("accepting_calls = 1");
      if (status === "Inactive") conditions.push("accepting_calls = 0");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    /* ---------- USERS LIST ---------- */
    const [users] = await db.query(
      `
      SELECT
        id,
        name,
        role,
        email,
        DATE_FORMAT(created_at, '%b %d, %Y') AS joiningDate,
        CASE
          WHEN accepting_calls = 1 THEN 'Active'
          ELSE 'Offline'
        END AS status
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      `,
      values
    );

    /* ---------- STATS ---------- */
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(accepting_calls = 1) AS active,
        SUM(accepting_calls = 0) AS inactive
      FROM users
    `);

    res.json({
      success: true,
      stats: {
        total: Number(stats.total),
        active: Number(stats.active),
        inactive: Number(stats.inactive),
      },
      users,
    });
  } catch (err) {
    console.error("WEB USERS LIST ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =================================================
   GET SINGLE USER (WEB)
   GET /web/users/:id
================================================= */
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        team,
        accepting_calls,
        DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS date_of_joining,
        profile_image
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    if (!user) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   UPDATE USER
   PUT /web/users/:id
================================ */
router.put(
  "/users/:id",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, role, team, status, password } = req.body;

      const fields = [];
      const values = [];

      if (name) fields.push("name = ?"), values.push(name);
      if (email) fields.push("email = ?"), values.push(email);
      if (phone) fields.push("phone = ?"), values.push(phone);
      if (role) fields.push("role = ?"), values.push(role);
      if (team) fields.push("team = ?"), values.push(team);

      if (status) {
        fields.push("accepting_calls = ?");
        values.push(status === "Active" ? 1 : 0);
      }

      if (password) {
        fields.push("password = ?");
        values.push(await bcrypt.hash(password, 10));
      }

      if (req.file) {
        fields.push("profile_image = ?");
        values.push(`/uploads/profiles/${req.file.filename}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false });
      }

      values.push(id);

      await db.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
        values
      );

      res.json({ success: true });
    } catch (err) {
      console.error("UPDATE USER ERROR:", err);
      res.status(500).json({ success: false });
    }
  }
);

module.exports = router;
