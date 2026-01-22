const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../db");

/* ===============================
   EMAIL TRANSPORTER (GMAIL - FORCED SMTP)
=============================== */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // IMPORTANT for Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
});

/* ===============================
   LOGIN
=============================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password required",
    });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        team: user.team,
        date_of_joining: user.date_of_joining,
        profile_image: user.profile_image,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ===============================
   FORGOT PASSWORD (EMAIL)
=============================== */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [users] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = users[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [token, expiry, userId]
    );

    const resetLink = `${process.env.FRONTEND_RESET_URL}?token=${encodeURIComponent(
      token
    )}`;

    // 🔥 VERIFY RIGHT BEFORE SENDING
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your password",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link is valid for 15 minutes.</p>
      `,
    });

    console.log("✅ Email sent:", info.response);

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("❌ Forgot password email error:", err);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

/* ===============================
   RESET PASSWORD
=============================== */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "Token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    const [users] = await db.query(
      `
      SELECT id FROM users
      WHERE reset_token = ?
        AND reset_token_expiry > ?
      `,
      [token, new Date()]
    );

    if (users.length === 0) {
      return res.status(400).json({
        error: "Invalid or expired token",
      });
    }

    const userId = users[0].id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `
      UPDATE users
      SET password = ?, reset_token = NULL, reset_token_expiry = NULL
      WHERE id = ?
      `,
      [hashedPassword, userId]
    );

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

module.exports = router;
