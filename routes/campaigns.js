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
    status = "draft",
    agent_ids = [],
    tags = [],
  } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Insert campaign
    const [result] = await connection.execute(
      `
      INSERT INTO campaigns
      (campaign_name, description, demographics, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [campaign_name, description, demographics, start_date, end_date, status]
    );

    const campaignId = result.insertId;

    // 2️⃣ Assign agents
    for (const agentId of agent_ids) {
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

    // Fetch assigned agents
    const [agents] = await connection.execute(
      `
      SELECT u.id, u.name, u.profile_image
      FROM campaign_agents ca
      JOIN users u ON u.id = ca.agent_id
      WHERE ca.campaign_id = ?
      `,
      [campaignId]
    );

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: {
        campaign: {
          id: campaignId,
          campaign_name,
          description,
          demographics,
          start_date,
          end_date,
          status,
          created_at: new Date(),
        },
        agents,
        tags,
        stats: {
          total_calls: 0,
          answered_calls: 0,
          missed_calls: 0,
          avg_duration: 0,
        },
      },
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
   GET ALL CAMPAIGNS
   (SAFE FOR ALL SCREENS)
========================= */
router.get("/", async (req, res) => {
  const { agentId } = req.query;

  try {
    const [campaigns] = await db.execute(
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
      ${agentId ? "WHERE ca.agent_id = ?" : ""}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      `,
      agentId ? [agentId] : []
    );

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
    console.error("Fetch campaigns error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


/* =========================
   GET SINGLE CAMPAIGN
========================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
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

    const [agents] = await db.execute(
      `
      SELECT u.id, u.name, u.phone, u.team, u.profile_image
      FROM campaign_agents ca
      JOIN users u ON u.id = ca.agent_id
      WHERE ca.campaign_id = ?
      `,
      [id]
    );

    const [tags] = await db.execute(
      `SELECT tag FROM campaign_tags WHERE campaign_id = ?`,
      [id]
    );

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
      data: {
        campaign,
        agents,
        tags: tags.map((t) => t.tag),
        stats: stats[0],
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

router.get("/:id/leads", async (req, res) => {
  const { id } = req.params;

  try {
    const [leads] = await db.execute(
      `
      SELECT
        l.id,
        IFNULL(l.name, '') AS name,
        IFNULL(l.company, '') AS company,
        IFNULL(l.phone, '') AS phone,
        IFNULL(l.email, '') AS email,
        IFNULL(l.status, 'New Lead') AS status,
        IFNULL(u.name, 'Unassigned') AS telecaller,
        IFNULL(
          DATE_FORMAT(l.updated_at, '%b %d, %Y %h:%i %p'),
          '-'
        ) AS last_activity
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.campaign_id = ?
      ORDER BY l.updated_at DESC
      `,
      [id]
    );

    res.json({
      success: true,
      data: leads,
    });
  } catch (err) {
    console.error("Fetch leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign leads",
    });
  }
});
router.post("/:id/leads/bulk", async (req, res) => {
  const { id: campaignId } = req.params;
  const { leads } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No leads provided",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const lead of leads) {
      await connection.execute(
        `
        INSERT INTO leads
        (campaign_id, name, company, phone, email, status)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          campaignId,
          lead.name ?? "",
          lead.company ?? "",
          lead.phone ?? "",
          lead.email ?? "",
          lead.status ?? "New Lead",
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Leads saved successfully",
      count: leads.length,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Bulk save leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save leads",
    });
  } finally {
    connection.release();
  }
});

router.post("/:id/leads", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    company,
    phone,
    email,
    status = "New Lead",
    assigned_agent_id = null,
  } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      message: "Name and phone are required",
    });
  }

  try {
    await db.execute(
      `
      INSERT INTO leads
      (campaign_id, name, company, phone, email, status, assigned_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [id, name, company, phone, email, status, assigned_agent_id]
    );

    res.json({
      success: true,
      message: "Lead added successfully",
    });
  } catch (err) {
    console.error("Add lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add lead",
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

/* =========================
   GET CAMPAIGN STATS
========================= */
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
