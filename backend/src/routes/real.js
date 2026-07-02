/**
 * routes/real.js
 * REST endpoints for Phase 3 real trading
 */
import { Router } from "express";
import {
  initExecutor,
  executeRealTrade,
  triggerEmergencyStop,
  clearEmergencyStop,
  getRealSummary,
  refreshBalance,
  executorState,
} from "../services/realExecutor.js";
import { telegram } from "../services/telegram.js";
import { query } from "../db/index.js";

const router = Router();

// GET /api/real/status
router.get("/status", (req, res) => {
  res.json(getRealSummary());
});

// POST /api/real/enable  — enable with confirmation
router.post("/enable", async (req, res) => {
  const { confirmed, maxTradeUsd } = req.body;
  if (!confirmed) {
    return res.status(400).json({ error: "Must send confirmed: true" });
  }

  if (executorState.emergencyStop) {
    return res.status(400).json({ error: "Emergency stop active. Clear it first." });
  }

  if (!executorState.keypair) {
    const ok = await initExecutor();
    if (!ok) return res.status(500).json({ error: "Wallet init failed. Check WALLET_PRIVATE_KEY in .env" });
  }

  executorState.isEnabled = true;
  console.log("✅ Real trading ENABLED");
  res.json({ ok: true, ...getRealSummary() });
});

// POST /api/real/disable
router.post("/disable", (req, res) => {
  executorState.isEnabled = false;
  console.log("⏸️  Real trading disabled");
  res.json({ ok: true });
});

// POST /api/real/emergency-stop
router.post("/emergency-stop", (req, res) => {
  const { reason } = req.body;
  triggerEmergencyStop(reason || "Manual emergency stop from dashboard");
  res.json({ ok: true, reason: executorState.emergencyReason });
});

// POST /api/real/clear-emergency
router.post("/clear-emergency", (req, res) => {
  clearEmergencyStop();
  res.json({ ok: true });
});

// POST /api/real/execute  — manual single trade
router.post("/execute", async (req, res) => {
  const { opportunity } = req.body;
  if (!opportunity) return res.status(400).json({ error: "opportunity required" });
  const result = await executeRealTrade(opportunity);
  if (!result.ok) return res.status(400).json({ error: result.reason });
  res.json(result);
});

// POST /api/real/test-telegram
router.post("/test-telegram", (req, res) => {
  if (!telegram.isEnabled()) {
    return res.status(400).json({
      error: "Telegram not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env"
    });
  }
  telegram.testAlert();
  res.json({ ok: true, message: "Test message sent to Telegram" });
});

// GET /api/real/history
router.get("/history", async (req, res) => {
  const { limit = 100 } = req.query;
  try {
    const { rows } = await query(
      `SELECT * FROM real_trades ORDER BY executed_at DESC LIMIT $1`,
      [Math.min(parseInt(limit), 1000)]
    );
    res.json({ data: rows, count: rows.length });
  } catch {
    res.json({ data: executorState.recentTrades, count: executorState.recentTrades.length });
  }
});

// GET /api/real/wallet
router.get("/wallet", async (req, res) => {
  if (!executorState.connection || !executorState.keypair) {
    return res.json({ address: null, solBalance: 0, usdBalance: 0 });
  }
  await refreshBalance(executorState.solPrice);
  res.json({
    address:    executorState.walletAddress,
    solBalance: executorState.solBalance,
    usdBalance: executorState.usdBalance,
    solPrice:   executorState.solPrice,
  });
});

export default router;
