/**
 * routes/paper.js
 * REST endpoints for paper trading control
 */
import { Router } from "express";
import {
  executePaperTrade,
  getPaperSummary,
  configurePaper,
  paperState,
} from "../services/paperTrading.js";
import { query } from "../db/index.js";

const router = Router();

// GET  /api/paper/status   — current state + recent trades
router.get("/status", (req, res) => {
  res.json(getPaperSummary());
});

// POST /api/paper/enable   — enable paper trading with config
router.post("/enable", (req, res) => {
  const { balance, tradeSize, autoMode } = req.body;

  if (balance && (isNaN(balance) || balance < 100 || balance > 1000000)) {
    return res.status(400).json({ error: "Balance must be between $100 and $1,000,000" });
  }
  if (tradeSize && (isNaN(tradeSize) || tradeSize < 10)) {
    return res.status(400).json({ error: "Trade size must be at least $10" });
  }

  configurePaper({ balance, tradeSize, autoMode: autoMode ?? false });
  paperState.isEnabled = true;

  res.json({ ok: true, ...getPaperSummary() });
});

// POST /api/paper/disable
router.post("/disable", (req, res) => {
  paperState.isEnabled = false;
  res.json({ ok: true, message: "Paper trading disabled" });
});

// POST /api/paper/mode     — toggle auto/manual
router.post("/mode", (req, res) => {
  const { autoMode } = req.body;
  if (typeof autoMode !== "boolean") {
    return res.status(400).json({ error: "autoMode must be boolean" });
  }
  paperState.autoMode = autoMode;
  res.json({ ok: true, autoMode: paperState.autoMode });
});

// POST /api/paper/execute  — manually trigger a trade
router.post("/execute", async (req, res) => {
  const { opportunity } = req.body;
  if (!opportunity) return res.status(400).json({ error: "opportunity required" });

  const result = await executePaperTrade(opportunity, "manual");
  if (!result.ok) return res.status(400).json({ error: result.reason });
  res.json(result);
});

// POST /api/paper/reset    — reset balance and stats
router.post("/reset", (req, res) => {
  const { balance } = req.body;
  configurePaper({ balance: balance || paperState.startBalance });
  res.json({ ok: true, ...getPaperSummary() });
});

// GET  /api/paper/history  — DB trade history
router.get("/history", async (req, res) => {
  const { limit = 100, token } = req.query;
  try {
    let sql = `SELECT * FROM paper_trades WHERE status = 'closed'`;
    const params = [];
    if (token) { sql += ` AND token = $1`; params.push(token.toUpperCase()); }
    sql += ` ORDER BY closed_at DESC LIMIT ${Math.min(parseInt(limit), 1000)}`;
    const { rows } = await query(sql, params);
    res.json({ data: rows, count: rows.length });
  } catch {
    // Return in-memory if DB not set up
    res.json({ data: paperState.recentTrades, count: paperState.recentTrades.length });
  }
});

// GET  /api/paper/stats    — aggregate performance stats
router.get("/stats", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)                                        AS total_trades,
        COUNT(*) FILTER (WHERE net_pnl > 0)            AS wins,
        COUNT(*) FILTER (WHERE net_pnl <= 0)           AS losses,
        COALESCE(SUM(net_pnl), 0)                      AS total_pnl,
        COALESCE(AVG(net_pnl), 0)                      AS avg_pnl,
        COALESCE(MAX(net_pnl), 0)                      AS best_trade,
        COALESCE(MIN(net_pnl), 0)                      AS worst_trade,
        COALESCE(SUM(fees_paid), 0)                    AS total_fees,
        COALESCE(AVG(gross_pnl), 0)                    AS avg_gross
      FROM paper_trades WHERE status = 'closed'
    `);
    res.json(rows[0]);
  } catch {
    res.json({});
  }
});

export default router;
