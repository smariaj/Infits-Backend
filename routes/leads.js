const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   CREATE SINGLE LEAD
========================= */
router.post("/", async (req, res) => {
  const {
    campaign_id,
    name,
    company,
    phone,
    email,
    status = "New Lead",
    assigned_agent_id = null,
  } = req.body;

  if (!campaign_id || !name || !phone) {
    return res.status(400).json({
      success: false,
      message: "campaign_id, name and phone are required",
    });
  }

  try {
    const [result] = await db.execute(
      `
      INSERT INTO leads
      (campaign_id, name, company, phone, email, status, assigned_agent_id, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        campaign_id,
        name,
        company || null,
        phone,
        email || null,
        status,
        assigned_agent_id,
        "Lead created",
      ]
    );

    const [[lead]] = await db.execute(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        l.last_activity,
        u.name AS telecaller
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (err) {
    console.error("Create lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create lead",
    });
  }
});

/* =========================
   BATCH CREATE LEADS WITH RANDOM ASSIGNMENT
========================= */
router.post("/batch", async (req, res) => {
  const { campaign_id, leads } = req.body; // leads = [{name, phone, email, company}, ...]

  if (!campaign_id || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({
      success: false,
      message: "campaign_id and leads array are required",
    });
  }

  try {
    // 1. Fetch agents of this campaign
    const [agents] = await db.execute(
      `SELECT u.id FROM users u
       JOIN campaign_agents ca ON u.id = ca.agent_id
       WHERE ca.campaign_id = ? AND u.status='active'`,
      [campaign_id]
    );

    if (agents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active agents found for this campaign",
      });
    }

    // 2. Shuffle leads
    const shuffledLeads = [...leads].sort(() => Math.random() - 0.5);

    // 3. Assign leads round-robin to agents
    const assignedLeads = shuffledLeads.map((lead, idx) => {
      const agent = agents[idx % agents.length];
      return [
        campaign_id,
        lead.name,
        lead.company || null,
        lead.phone,
        lead.email || null,
        "New Lead",
        agent.id,
        "Lead created",
      ];
    });

    // 4. Insert all leads in batch
    await db.query(
      `INSERT INTO leads
      (campaign_id, name, company, phone, email, status, assigned_agent_id, last_activity)
      VALUES ?`,
      [assignedLeads]
    );

    res.json({
      success: true,
      message: `${leads.length} leads uploaded and randomly assigned successfully`,
    });
  } catch (err) {
    console.error("Batch upload leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload leads",
    });
  }
});

/* =========================
   GET LEADS (FILTERABLE)
========================= */
router.get("/", async (req, res) => {
  const { campaign_id, agent_id } = req.query;
  let conditions = [];
  let params = [];

  if (campaign_id) {
    conditions.push("l.campaign_id = ?");
    params.push(campaign_id);
  }

  if (agent_id) {
    conditions.push("l.assigned_agent_id = ?");
    params.push(agent_id);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [leads] = await db.execute(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        l.last_activity,
        u.name AS telecaller
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      ${whereClause}
      ORDER BY l.created_at DESC
      `,
      params
    );

    res.json({
      success: true,
      data: leads,
    });
  } catch (err) {
    console.error("Fetch leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leads",
    });
  }
});

/* =========================
   GET LEADS BY CAMPAIGN ID (FOR FLUTTER)
========================= */
router.get("/campaign/:campaignId", async (req, res) => {
  const campaignId = parseInt(req.params.campaignId);

  if (isNaN(campaignId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid campaign ID",
    });
  }

  try {
    const [leads] = await db.execute(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        l.last_activity,
        u.name AS telecaller
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.campaign_id = ?
      ORDER BY l.created_at DESC
      `,
      [campaignId]
    );

    res.json({
      success: true,
      data: leads,
    });
  } catch (err) {
    console.error("Fetch leads by campaign error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leads for this campaign",
    });
  }
});

/* =========================
   GET SINGLE LEAD BY ID
========================= */
router.get("/:id", async (req, res) => {
  const leadId = parseInt(req.params.id);

  if (isNaN(leadId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid lead ID",
    });
  }

  try {
    const [[lead]] = await db.execute(
      `
      SELECT
        l.id,
        l.name,
        l.company,
        l.phone,
        l.email,
        l.status,
        l.last_activity,
        l.created_at,
        u.name AS telecaller
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_agent_id
      WHERE l.id = ?
      `,
      [leadId]
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (err) {
    console.error("Fetch single lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead",
    });
  }
});

/* =========================
   UPDATE LEAD STATUS
========================= */
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["New Lead","Interested","Call Back","Converted"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status",
    });
  }

  try {
    await db.execute(
      `UPDATE leads SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({
      success: true,
      message: "Lead status updated",
    });
  } catch (err) {
    console.error("Update lead status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update lead status",
    });
  }
});

/* =========================
   LOG LEAD CALL AND UPDATE CAMPAIGN PROGRESS
========================= */
router.post("/:id/log_call", async (req, res) => {
  const leadId = req.params.id;
  const { agent_id } = req.body;

  if (!agent_id) {
    return res.status(400).json({
      success: false,
      message: "agent_id is required",
    });
  }

  try {
    // 1️⃣ Insert lead activity
    await db.execute(
      `
      INSERT INTO lead_activities
      (lead_id, type, title, description, user)
      VALUES (?, 'call', 'Call made', 'Lead called by agent', ?)
      `,
      [leadId, agent_id]
    );

    // 2️⃣ Update lead last activity
    await db.execute(
      `
      UPDATE leads
      SET last_activity = 'Call made'
      WHERE id = ?
      `,
      [leadId]
    );

    // 3️⃣ Get the campaign id for this lead
    const [[lead]] = await db.execute(
      `SELECT campaign_id FROM leads WHERE id = ?`,
      [leadId]
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const campaignId = lead.campaign_id;

    // 4️⃣ Count how many leads of this campaign are called
    const [[{ calledCount }]] = await db.execute(
      `
      SELECT COUNT(*) AS calledCount
      FROM lead_activities la
      JOIN leads l ON la.lead_id = l.id
      WHERE l.campaign_id = ? AND la.type = 'call'
      `,
      [campaignId]
    );

    // 5️⃣ Update campaigns table progress column (optional if you have one)
    await db.execute(
      `
      UPDATE campaigns
      SET called = ?
      WHERE id = ?
      `,
      [calledCount, campaignId]
    );

    res.json({
      success: true,
      message: "Call logged and campaign progress updated",
      data: {
        campaign_id: campaignId,
        called: calledCount,
      },
    });
  } catch (err) {
    console.error("Log lead call error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to log call",
    });
  }
});


module.exports = router;
