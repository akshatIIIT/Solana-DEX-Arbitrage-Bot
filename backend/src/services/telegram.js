/**
 * services/telegram.js
 * Sends Telegram alerts for every trade, error, and opportunity.
 *
 * Setup (free):
 *  1. Message @BotFather on Telegram → /newbot → get BOT_TOKEN
 *  2. Message your new bot once, then visit:
 *     https://api.telegram.org/bot<TOKEN>/getUpdates
 *  3. Copy the chat_id from the response
 *  4. Add both to backend/.env
 */
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const BASE_URL  = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

let isEnabled = !!(BOT_TOKEN && CHAT_ID);
let messageQueue = [];
let isSending = false;

// Rate limit: Telegram allows 30 messages/sec but we throttle to 1/sec
async function flushQueue() {
  if (isSending || messageQueue.length === 0) return;
  isSending = true;

  const { text, parseMode } = messageQueue.shift();
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id:    CHAT_ID,
      text,
      parse_mode: parseMode || "HTML",
      disable_web_page_preview: true,
    }, { timeout: 5000 });
  } catch (err) {
    // Don't crash bot on Telegram failure
    console.error("Telegram send failed:", err.message);
  }

  isSending = false;
  if (messageQueue.length > 0) {
    setTimeout(flushQueue, 1000);
  }
}

function send(text, parseMode = "HTML") {
  if (!isEnabled) return;
  messageQueue.push({ text, parseMode });
  flushQueue();
}

// ─── Alert Templates ─────────────────────────────────────────────────────────

export function alertStartup(walletAddress, balance) {
  send(
    `⚡ <b>Solana Arb Bot — Phase 3 Started</b>\n\n` +
    `💼 Wallet: <code>${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-6)}</code>\n` +
    `💰 Balance: <b>${balance.toFixed(4)} SOL</b>\n` +
    `🌐 Network: Mainnet\n` +
    `⏰ ${new Date().toLocaleString()}`
  );
}

export function alertTradeExecuted(trade) {
  const pnlSign  = trade.netPnlUsd >= 0 ? "+" : "";
  const pnlEmoji = trade.netPnlUsd >= 0 ? "✅" : "❌";

  send(
    `${pnlEmoji} <b>TRADE EXECUTED</b>\n\n` +
    `🪙 Token: <b>${trade.token}</b>\n` +
    `📈 Route: ${trade.buyDex} → ${trade.sellDex}\n` +
    `💵 Size: $${trade.tradeSizeUsd.toFixed(2)}\n` +
    `📊 Spread: ${trade.spreadPct.toFixed(3)}%\n` +
    `💸 Fees: -$${trade.feesUsd.toFixed(3)}\n` +
    `${pnlEmoji} Net P&L: <b>${pnlSign}$${trade.netPnlUsd.toFixed(3)}</b>\n` +
    `💼 New Balance: $${trade.newBalanceUsd.toFixed(2)}\n` +
    `🔗 <a href="https://solscan.io/tx/${trade.txSignature}">View on Solscan</a>`
  );
}

export function alertOpportunity(opp) {
  send(
    `🎯 <b>OPPORTUNITY DETECTED</b>\n\n` +
    `🪙 ${opp.token}: ${opp.buyDex} → ${opp.sellDex}\n` +
    `📊 Spread: <b>${opp.spreadPct.toFixed(3)}%</b>\n` +
    `💵 Est. Net Profit: <b>+$${opp.netProfitUsd.toFixed(2)}</b> per $1k\n` +
    `⏰ ${new Date().toLocaleTimeString()}`
  );
}

export function alertError(message, context = "") {
  send(
    `🚨 <b>BOT ERROR</b>\n\n` +
    `❌ ${message}\n` +
    (context ? `📝 ${context}\n` : "") +
    `⏰ ${new Date().toLocaleTimeString()}`
  );
}

export function alertEmergencyStop(reason, stats) {
  send(
    `🛑 <b>EMERGENCY STOP TRIGGERED</b>\n\n` +
    `⚠️ Reason: <b>${reason}</b>\n\n` +
    `📊 Session Stats:\n` +
    `   Trades: ${stats.tradesTotal}\n` +
    `   P&L: ${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}\n` +
    `   Win Rate: ${stats.winRate}%\n\n` +
    `🔒 All trading halted. Restart manually to resume.`
  );
}

export function alertDailyLimit(todayPnl, limitPct) {
  send(
    `⚠️ <b>DAILY LOSS LIMIT HIT</b>\n\n` +
    `📉 Today's P&L: <b>$${todayPnl.toFixed(2)}</b>\n` +
    `🔒 Limit: ${limitPct}% of balance\n` +
    `⏸️ Trading paused until midnight.\n\n` +
    `Check dashboard to review.`
  );
}

export function alertLowBalance(solBalance, usdValue) {
  send(
    `⚠️ <b>LOW BALANCE WARNING</b>\n\n` +
    `💼 Balance: ${solBalance.toFixed(4)} SOL (~$${usdValue.toFixed(2)})\n` +
    `🔴 Less than $10 remaining.\n` +
    `⏸️ Trading paused to prevent dust.`
  );
}

export function alertStatus(stats) {
  const pnlSign  = stats.totalPnl >= 0 ? "+" : "";
  const pnlEmoji = stats.totalPnl >= 0 ? "📈" : "📉";
  send(
    `📊 <b>Hourly Status Update</b>\n\n` +
    `${pnlEmoji} P&L: <b>${pnlSign}$${stats.totalPnl.toFixed(2)}</b>\n` +
    `🎯 Win Rate: ${stats.winRate}%\n` +
    `🔄 Trades: ${stats.tradesTotal} (${stats.tradesWon}W / ${stats.tradesLost}L)\n` +
    `💼 Balance: $${stats.balanceUsd.toFixed(2)}\n` +
    `🔍 Best Spread: ${stats.bestSpread.toFixed(3)}%\n` +
    `⏰ ${new Date().toLocaleString()}`
  );
}

export function testAlert() {
  send(
    `✅ <b>Telegram Connected!</b>\n\n` +
    `Your Solana Arb Bot alerts are working.\n` +
    `You'll receive notifications for every trade.\n\n` +
    `⏰ ${new Date().toLocaleString()}`
  );
}

export const telegram = {
  isEnabled: () => isEnabled,
  send,
  alertStartup,
  alertTradeExecuted,
  alertOpportunity,
  alertError,
  alertEmergencyStop,
  alertDailyLimit,
  alertLowBalance,
  alertStatus,
  testAlert,
};
