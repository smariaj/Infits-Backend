const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("../db"); // Use promise wrapper for async/await

// ---------------- Multer setup ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ---------------- Add User Route ----------------
router.post("/add-user", upload.single("profile_image"), async (req, res) => {
  try {
    const { name, email, phone, password, role, team, date_of_joining } = req.body;
    const profile_image = req.file ? req.file.filename : null;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password required" });
    }

    // Check duplicate email
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    const sql = `INSERT INTO users
      (name, email, phone, password, role, team, date_of_joining, profile_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await db.query(sql, [
      name,
      email,
      phone,
      hashedPassword,
      role,
      team,
      date_of_joining,
      profile_image,
    ]);

    return res.status(200).json({
      success: true,
      message: "User added successfully",
      userId: result.insertId,
    });
  } catch (err) {
    console.error("Add user error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
