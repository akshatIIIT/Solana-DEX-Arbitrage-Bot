/**
 * services/paperTrading.js
 * Phase 2 — Paper Trading Engine
 *
 * Simulates real trades with:
 *  - Realistic fee model (trading fee + slippage + network)
 *  - Auto mode (executes all viable opps automatically)
 *  - Manual mode (waits for user to click execute)
 *  - Full trade history with PnL tracking
 *  - Daily loss limit (2% of starting balance)
 *  - Per-trade size limit
 */

import { query } from "../db/index.js";
// import { logger } from "../utils/logger.js";
const logger = { info: console.log, warn: console.warn, error: console.error };

// ─── Fee Model (realistic mainnet estimates) ───────────────────────────────
const FEE = {
  TRADING_EACH_SIDE: 0.0025,  // 0.25% per swap × 2 sides = 0.5% total
  SLIPPAGE:          0.002,   // 0.2% average slippage
  NETWORK_USD:       0.004,   // ~$0.004 per round trip (2 txns)
};
const TOTAL_FEE_PCT = FEE.TRADING_EACH_SIDE * 2 + FEE.SLIPPAGE;

// ─── In-memory state ────────────────────────────────────────────────────────
export const paperState = {
  isEnabled:    false,
  autoMode:     false,
  balance:      10000,        // starting balance (USD), user-configurable
  startBalance: 10000,
  tradeSize:    1000,         // USD per trade
  totalPnl:     0,
  todayPnl:     0,
  todayStart:   new Date().toDateString(),
  tradesTotal:  0,
  tradesWon:    0,
  tradesLost:   0,
  activeTrades: [],           // currently open simulated positions
  recentTrades: [],           // last 50 closed trades (in-memory cache)
  dailyLossLimit: 0.02,       // 2% of startBalance
  broadcastFn:  null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function resetDailyPnlIfNeeded() {
  const today = new Date().toDateString();
  if (paperState.todayStart !== today) {
    paperState.todayPnl = 0;
    paperState.todayStart = today;
  }
}

function isDailyLimitHit() {
  resetDailyPnlIfNeeded();
  const maxDailyLoss = paperState.startBalance * paperState.dailyLossLimit;
  return paperState.todayPnl <= -maxDailyLoss;
}

function calcFees(tradeSizeUsd) {
  return (TOTAL_FEE_PCT * tradeSizeUsd) + FEE.NETWORK_USD;
}

function broadcast(event, data) {
  if (paperState.broadcastFn) paperState.broadcastFn(event, data);
}

// ─── Core: Execute a paper trade ────────────────────────────────────────────
export async function executePaperTrade(opportunity, triggeredBy = "auto") {
  if (!paperState.isEnabled) return { ok: false, reason: "Paper trading disabled" };
  if (isDailyLimitHit())    return { ok: false, reason: "Daily loss limit reached (2%)" };
  if (paperState.balance < paperState.tradeSize)
    return { ok: false, reason: "Insufficient paper balance" };

  const size = paperState.tradeSize;
  const fees = calcFees(size);
  const grossProfit = (opportunity.spreadPct / 100) * size;
  const netPnl = grossProfit - fees;

  // Simulate 80ms–400ms execution delay (realistic)
  const execMs = Math.floor(Math.random() * 320 + 80);
  await new Promise(r => setTimeout(r, execMs));

  // Small random slippage variance (±20% of estimated slippage)
  const slippageVariance = (Math.random() - 0.5) * 0.4 * (FEE.SLIPPAGE * size);
  const actualNetPnl = parseFloat((netPnl + slippageVariance).toFixed(4));
  const won = actualNetPnl > 0;

  // Update state
  paperState.balance     = parseFloat((paperState.balance + actualNetPnl).toFixed(4));
  paperState.totalPnl    = parseFloat((paperState.totalPnl + actualNetPnl).toFixed(4));
  paperState.todayPnl    = parseFloat((paperState.todayPnl + actualNetPnl).toFixed(4));
  paperState.tradesTotal++;
  if (won) paperState.tradesWon++; else paperState.tradesLost++;

  const trade = {
    id:           Date.now(),
    token:        opportunity.token,
    buyDex:       opportunity.buyDex,
    sellDex:      opportunity.sellDex,
    spreadPct:    opportunity.spreadPct,
    buyPrice:     opportunity.buyPrice,
    sellPrice:    opportunity.sellPrice,
    tradeSize:    size,
    grossProfit:  parseFloat(grossProfit.toFixed(4)),
    fees:         parseFloat(fees.toFixed(4)),
    netPnl:       actualNetPnl,
    won,
    triggeredBy,  // 'auto' | 'manual'
    execMs,
    balance:      paperState.balance,
    executedAt:   new Date().toISOString(),
  };

  // Add to in-memory cache (keep last 50)
  paperState.recentTrades = [trade, ...paperState.recentTrades].slice(0, 50);

  // Persist to DB
  await query(`
    INSERT INTO paper_trades
      (token, buy_dex, sell_dex, trade_size_usd, entry_price, exit_price,
       gross_pnl, fees_paid, net_pnl, status, closed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'closed', NOW())
  `, [
    trade.token, trade.buyDex, trade.sellDex, trade.tradeSize,
    trade.buyPrice, trade.sellPrice, trade.grossProfit, trade.fees, trade.netPnl,
  ]).catch(() => {}); // DB optional

  logger.info(
    `📄 PAPER [${triggeredBy.toUpperCase()}] ${trade.token} ${trade.buyDex}→${trade.sellDex} | ` +
    `spread ${trade.spreadPct.toFixed(3)}% | net ${actualNetPnl >= 0 ? "+" : ""}$${actualNetPnl.toFixed(2)} | ` +
    `balance $${paperState.balance.toFixed(2)}`
  );

  broadcast("paper_trade", { trade, state: getPaperSummary() });
  return { ok: true, trade };
}

// ─── Called by scanner when it finds a viable opp ──────────────────────────
export async function onViableOpportunity(opportunity) {
  if (!paperState.isEnabled || !paperState.autoMode) return;
  await executePaperTrade(opportunity, "auto");
}

// ─── Public summary for API / websocket ────────────────────────────────────
export function getPaperSummary() {
  const winRate = paperState.tradesTotal > 0
    ? ((paperState.tradesWon / paperState.tradesTotal) * 100).toFixed(1)
    : "0.0";

  resetDailyPnlIfNeeded();
  const dailyLimitUsd = paperState.startBalance * paperState.dailyLossLimit;
  const dailyLimitUsed = paperState.todayPnl < 0
    ? (Math.abs(paperState.todayPnl) / dailyLimitUsd * 100).toFixed(1)
    : "0.0";

  return {
    isEnabled:      paperState.isEnabled,
    autoMode:       paperState.autoMode,
    balance:        paperState.balance,
    startBalance:   paperState.startBalance,
    tradeSize:      paperState.tradeSize,
    totalPnl:       paperState.totalPnl,
    todayPnl:       paperState.todayPnl,
    pnlPct:         ((paperState.totalPnl / paperState.startBalance) * 100).toFixed(2),
    tradesTotal:    paperState.tradesTotal,
    tradesWon:      paperState.tradesWon,
    tradesLost:     paperState.tradesLost,
    winRate,
    dailyLimitUsed,
    dailyLimitHit:  isDailyLimitHit(),
    recentTrades:   paperState.recentTrades,
  };
}

// ─── Configure ──────────────────────────────────────────────────────────────
export function configurePaper({ balance, tradeSize, autoMode }) {
  if (balance !== undefined) {
    paperState.balance      = parseFloat(balance);
    paperState.startBalance = parseFloat(balance);
    paperState.totalPnl     = 0;
    paperState.todayPnl     = 0;
    paperState.tradesTotal  = 0;
    paperState.tradesWon    = 0;
    paperState.tradesLost   = 0;
    paperState.recentTrades = [];
  }
  if (tradeSize !== undefined) paperState.tradeSize = parseFloat(tradeSize);
  if (autoMode  !== undefined) paperState.autoMode  = autoMode;
}

export function setBroadcastPaper(fn) {
  paperState.broadcastFn = fn;
}
