const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   CREATE CAMPAIGN
========================= */
router.post("/", async (req, res) => {
  const {
    campaign_name,
    description,
    demographics,
    start_date,
    end_date,
    agents = [],
    tags = [],
  } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Insert campaign
    const [result] = await connection.execute(
      `
      INSERT INTO campaigns
      (campaign_name, description, demographics, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [campaign_name, description, demographics, start_date, end_date]
    );

    const campaignId = result.insertId;

    // 2️⃣ Assign agents
    for (const agentId of agents) {
      await connection.execute(
        `
        INSERT INTO campaign_agents (campaign_id, agent_id)
        VALUES (?, ?)
        `,
        [campaignId, agentId]
      );
    }

    // 3️⃣ Insert tags
    for (const tag of tags) {
      await connection.execute(
        `
        INSERT INTO campaign_tags (campaign_id, tag)
        VALUES (?, ?)
        `,
        [campaignId, tag]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaign_id: campaignId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Create campaign error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create campaign",
    });
  } finally {
    connection.release();
  }
});

/* =========================
   GET ALL agent specific CAMPAIGNS
========================= */
router.get("/", async (req, res) => {
  const { agentId } = req.query; // get agentId from query params

  try {
    const [rows] = await db.execute(`
      SELECT
        c.id,
        c.campaign_name,
        c.start_date,
        c.end_date,
        c.status,
        c.created_at,
        c.demographics,
        COUNT(DISTINCT ca.agent_id) AS agent_count,
        COUNT(DISTINCT ct.id) AS tag_count
      FROM campaigns c
      LEFT JOIN campaign_agents ca ON ca.campaign_id = c.id
      LEFT JOIN campaign_tags ct ON ct.campaign_id = c.id
      ${agentId ? 'WHERE ca.agent_id = ?' : ''}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, agentId ? [agentId] : []);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Fetch campaigns error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
    });
  }
});

/* =========================
   GET SINGLE CAMPAIGN
========================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Campaign
    const [[campaign]] = await db.execute(
      `SELECT * FROM campaigns WHERE id = ?`,
      [id]
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Agents
    const [agents] = await db.execute(
      `
      SELECT
        u.id,
        u.name,
        u.phone,
        u.team,
        u.profile_image
      FROM campaign_agents ca
      JOIN users u ON u.id = ca.agent_id
      WHERE ca.campaign_id = ?
      `,
      [id]
    );

    // Tags
    const [tags] = await db.execute(
      `SELECT tag FROM campaign_tags WHERE campaign_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        campaign,
        agents,
        tags: tags.map(t => t.tag),
      },
    });
  } catch (err) {
    console.error("Fetch campaign error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign",
    });
  }
});

/* =========================
   UPDATE CAMPAIGN STATUS
========================= */
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["draft", "active", "completed"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status",
    });
  }

  try {
    await db.execute(
      `UPDATE campaigns SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({
      success: true,
      message: "Campaign status updated",
    });
  } catch (err) {
    console.error("Update campaign status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
    });
  }
});

/**
 * GET /campaigns/:id/stats
 * Returns call stats for a campaign
 */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const [stats] = await db.execute(
      `
      SELECT
        COUNT(*) AS total_calls,
        SUM(connected) AS answered_calls,
        SUM(CASE WHEN type='missed' THEN 1 ELSE 0 END) AS missed_calls,
        ROUND(AVG(duration), 2) AS avg_duration
      FROM call_stats
      WHERE campaign_id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (err) {
    console.error("Campaign stats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign stats",
    });
  }
});


module.exports = router;
