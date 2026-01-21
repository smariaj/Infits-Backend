const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
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

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    const sql = `
      INSERT INTO users
      (name, email, phone, password, role, team, date_of_joining, profile_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      name,
      email,
      phone,
      hashedPassword,
      role || "agent",
      team,
      date_of_joining,
      profile_image,
    ]);

    return res.status(200).json({
      success: true,
      message: "User added successfully",
      userId: result.insertId,
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
router.get("/users", async (req, res) => {
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
        status,
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

// ---------------- UPDATE USER PROFILE ----------------
// ---------------- UPDATE USER ----------------
router.put(
  "/update-user/:id",
  upload.single("profile_image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone } = req.body;

      // Check if user exists
      const [existing] = await db.query(
        "SELECT id FROM users WHERE id = ?",
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const profile_image = req.file
        ? req.file.filename
        : null;

      // Build dynamic update query
      const fields = [];
      const values = [];

      if (name) {
        fields.push("name = ?");
        values.push(name);
      }
      if (email) {
        fields.push("email = ?");
        values.push(email);
      }
      if (phone) {
        fields.push("phone = ?");
        values.push(phone);
      }
      if (profile_image) {
        fields.push("profile_image = ?");
        values.push(profile_image);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No data to update",
        });
      }

      values.push(id);

      const sql = `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = ?
      `;

      await db.query(sql, values);

      return res.json({
        success: true,
        message: "Profile updated",
        data: {
          id,
          name,
          email,
          phone,
          profile_image,
        },
      });
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);


module.exports = router;


