const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const db = require("../db");

/* ================= ENSURE UPLOADS FOLDER ================= */
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* =================================================
   ADD USER (WEB ADMIN)
   POST /web/users
================================================= */
router.post("/users", upload.single("profile_image"), async (req, res) => {
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
    const profileImage = req.file ? req.file.filename : null;

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
        role && role.trim() !== "" ? role : "agent",
        team || null,
        date_of_joining && date_of_joining.trim() !== ""
          ? date_of_joining
          : null,
        profileImage,
      ]
    );

    res.json({ success: true, message: "User added successfully" });
  } catch (err) {
    console.error("WEB ADD USER ERROR:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/* =================================================
   GET TEAM MEMBERS (WEB)
   GET /web/users
================================================= */
router.get("/users", async (req, res) => {
  try {
    const { search, role, status } = req.query;

    let conditions = [];
    let values = [];

    if (search) {
      conditions.push("(name LIKE ? OR email LIKE ? OR role LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role && role !== "All Roles") {
      conditions.push("role = ?");
      values.push(role);
    }

    if (status) {
      if (status === "Active") {
        conditions.push("accepting_calls = 1");
      } else if (status === "Inactive") {
        conditions.push("accepting_calls = 0");
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        role,
        email,
        DATE_FORMAT(date_of_joining, '%b %d, %Y') AS joiningDate,
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

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("WEB USERS LIST ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to load users" });
  }
});

/* =================================================
   TEAM STATS (WEB)
   GET /web/users/stats
================================================= */
router.get("/users/stats", async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS totalMembers,
        SUM(accepting_calls = 1) AS activeMembers
      FROM users
    `);

    res.json({
      success: true,
      data: {
        totalMembers: stats.totalMembers,
        activeMembers: stats.activeMembers,
        avgPerformance: 88, // placeholder
      },
    });
  } catch (err) {
    console.error("WEB USER STATS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to load stats" });
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
        DATE_FORMAT(date_of_joining, '%b %d, %Y') AS joiningDate,
        accepting_calls,
        profile_image
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...user,
        status: user.accepting_calls === 1 ? "Active" : "Offline",
      },
    });
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =================================================
   UPDATE USER (WEB)
   PUT /web/users/:id
================================================= */
router.put(
  "/users/:id",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, role, team, status } = req.body;

      const acceptingCalls = status === "Active" ? 1 : 0;
      const profileImage = req.file ? req.file.filename : null;

      const fields = [];
      const values = [];

      if (name) fields.push("name = ?"), values.push(name);
      if (email) fields.push("email = ?"), values.push(email);
      if (phone) fields.push("phone = ?"), values.push(phone);
      if (role) fields.push("role = ?"), values.push(role);
      if (team) fields.push("team = ?"), values.push(team);
      fields.push("accepting_calls = ?");
      values.push(acceptingCalls);

      if (profileImage) {
        fields.push("profile_image = ?");
        values.push(profileImage);
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
