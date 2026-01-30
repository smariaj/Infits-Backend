const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   GET ALL CAMPAIGNS (WEB)
   NO TAGS, SAFE
========================= */
router.get("/", async (req, res) => {
  try {
    const [campaigns] = await db.execute(`
      SELECT
        c.id,
        c.campaign_name,
        c.start_date,
        c.end_date,
        c.status,
        c.created_at,
        c.demographics,
        COUNT(DISTINCT ca.agent_id) AS agent_count
      FROM campaigns c
      LEFT JOIN campaign_agents ca ON ca.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    for (const campaign of campaigns) {
      const [agents] = await db.execute(
        `
        SELECT u.id, u.name, u.profile_image
        FROM campaign_agents ca
        JOIN users u ON u.id = ca.agent_id
        WHERE ca.campaign_id = ?
        `,
        [campaign.id]
      );

      campaign.agents = agents;
    }

    res.json({ success: true, data: campaigns });
  } catch (err) {
    console.error("WEB CAMPAIGN ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =================================================
   CREATE CAMPAIGN (WEB)
   POST /web/campaigns
================================================= */
router.post("/", async (req, res) => {
  const {
    campaign_name,
    description,
    demographics,
    start_date,
    end_date,
    status = "draft",
    agent_ids = [],
    tags = [] // future use, DB me store nahi ho raha
  } = req.body;

  if (!campaign_name || !start_date || !end_date) {
    return res.status(400).json({
      success: false,
      message: "Required fields missing",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Insert campaign
    const [result] = await connection.query(
      `
      INSERT INTO campaigns
      (campaign_name, description, demographics, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        campaign_name,
        description || null,
        demographics || null,
        start_date,
        end_date,
        status,
      ]
    );

    const campaignId = result.insertId;

    // 2️⃣ Assign agents (SAFE LOOP)
    for (const agentId of agent_ids) {
      await connection.query(
        `
        INSERT INTO campaign_agents (campaign_id, agent_id)
        VALUES (?, ?)
        `,
        [campaignId, agentId]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: {
        id: campaignId,
        campaign_name,
        start_date,
        end_date,
        status,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("WEB CREATE CAMPAIGN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create campaign",
    });
  } finally {
    connection.release();
  }
});

/* =================================================
   GET ALL CAMPAIGNS (WEB)
   GET /web/campaigns
================================================= */
router.get("/", async (req, res) => {
  try {
    const [campaigns] = await db.query(
      `
      SELECT
        c.id,
        c.campaign_name,
        c.start_date,
        c.end_date,
        c.status,
        c.created_at,
        c.demographics,
        COUNT(DISTINCT ca.agent_id) AS agent_count
      FROM campaigns c
      LEFT JOIN campaign_agents ca ON ca.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      `
    );

    // attach agents list
    for (const campaign of campaigns) {
      const [agents] = await db.query(
        `
        SELECT u.id, u.name, u.profile_image
        FROM campaign_agents ca
        JOIN users u ON u.id = ca.agent_id
        WHERE ca.campaign_id = ?
        `,
        [campaign.id]
      );

      campaign.agents = agents;
    }

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err) {
    console.error("WEB FETCH CAMPAIGNS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
    });
  }
});

/* =================================================
   GET SINGLE CAMPAIGN (WEB)
   GET /web/campaigns/:id
================================================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [[campaign]] = await db.query(
      `SELECT * FROM campaigns WHERE id = ?`,
      [id]
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    const [agents] = await db.query(
      `
      SELECT u.id, u.name, u.phone, u.team
      FROM campaign_agents ca
      JOIN users u ON u.id = ca.agent_id
      WHERE ca.campaign_id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      data: {
        campaign,
        agents,
      },
    });
  } catch (err) {
    console.error("WEB GET CAMPAIGN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign",
    });
  }
});

/* =================================================
   UPDATE CAMPAIGN STATUS (WEB)
   PUT /web/campaigns/:id/status
================================================= */
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
    await db.query(
      `UPDATE campaigns SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({
      success: true,
      message: "Campaign status updated",
    });
  } catch (err) {
    console.error("WEB UPDATE STATUS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update campaign",
    });
  }
});

module.exports = router;
