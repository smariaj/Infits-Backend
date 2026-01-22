const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

// ---------------- MULTER SETUP ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ---------------- ADD USER ----------------
router.post("/add-user", upload.single("profile_image"), async (req, res) => {
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

    const profile_image = req.file ? req.file.filename : null;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check duplicate email
    const [existingUser] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Generate user ID
    const userId = uuidv4();

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    const sql = `
      INSERT INTO users
      (id, name, email, phone, password, role, team, date_of_joining, profile_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      userId,
      name,
      email,
      phone,
      hashedPassword,
      role || "agent",
      team || null,
      date_of_joining || null,
      profile_image,
    ]);

    return res.status(200).json({
      success: true,
      message: "User added successfully",
      userId,
    });
  } catch (error) {
    console.error("Add user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ---------------- GET ALL USERS ----------------
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        name,
        email,
        phone,
        role,
        team,
        DATE_FORMAT(date_of_joining, '%b %d, %Y') AS date_of_joining,
        accepting_calls,
        profile_image,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
