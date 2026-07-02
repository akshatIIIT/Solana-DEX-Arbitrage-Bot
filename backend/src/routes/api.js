/**
 * routes/api.js — REST endpoints
 */
import { Router } from "express";
import { query } from "../db/index.js";
import { scannerState, startScanner, stopScanner } from "../services/scanner.js";

const router = Router();

// ── Health check ─────────────────────────
router.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── Scanner status + live data ───────────
router.get("/status", (req, res) => {
  res.json({
    isRunning: scannerState.isRunning,
    startedAt: scannerState.startedAt,
    lastScanAt: scannerState.lastScanAt,
    scansTotal: scannerState.scansTotal,
    oppsFound: scannerState.oppsFound,
    bestSpreadEver: scannerState.bestSpreadEver,
    prices: scannerState.latestPrices,
    opportunities: scannerState.latestOpps,
  });
});

// ── Scanner control ──────────────────────
router.post("/scanner/start", (req, res) => {
  startScanner();
  res.json({ ok: true, message: "Scanner started" });
});

router.post("/scanner/stop", (req, res) => {
  stopScanner();
  res.json({ ok: true, message: "Scanner stopped" });
});

// ── Historical opportunities ─────────────
router.get("/opportunities", async (req, res) => {
  const { limit = 50, token, viable } = req.query;
  try {
    let sql = `
      SELECT * FROM opportunities
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (token) { sql += ` AND token = $${idx++}`; params.push(token); }
    if (viable === "true") { sql += ` AND is_viable = true`; }

    sql += ` ORDER BY detected_at DESC LIMIT $${idx}`;
    params.push(Math.min(parseInt(limit), 500));

    const { rows } = await query(sql, params);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Historical prices ────────────────────
router.get("/prices/:token", async (req, res) => {
  const { token } = req.params;
  const { minutes = 60 } = req.query;
  try {
    const { rows } = await query(`
      SELECT source, price_usd, fetched_at
      FROM price_snapshots
      WHERE token = $1
        AND fetched_at > NOW() - INTERVAL '${parseInt(minutes)} minutes'
      ORDER BY fetched_at ASC
    `, [token.toUpperCase()]);
    res.json({ token, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats summary ────────────────────────
router.get("/stats/summary", async (req, res) => {
  try {
    const [oppStats, spreadStats] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE is_viable) AS viable_count,
          COUNT(*) AS total_count,
          MAX(spread_pct) AS best_spread,
          AVG(spread_pct) AS avg_spread,
          MAX(net_profit_usd) AS best_net_profit
        FROM opportunities
        WHERE detected_at > NOW() - INTERVAL '24 hours'
      `),
      query(`
        SELECT token, MAX(spread_pct) AS best_spread, COUNT(*) AS opp_count
        FROM opportunities
        WHERE detected_at > NOW() - INTERVAL '24 hours'
        GROUP BY token
        ORDER BY best_spread DESC
      `),
    ]);

    res.json({
      last24h: oppStats.rows[0],
      byToken: spreadStats.rows,
    });
  } catch (err) {
    // Return empty stats if DB not ready
    res.json({ last24h: {}, byToken: [] });
  }
});

export default router;
