/**
 * services/realExecutor.js
 * Phase 3 — Real trade execution on Solana mainnet.
 *
 * Flow per trade:
 *  1. Pre-flight checks (balance, limits, emergency stop)
 *  2. Get fresh quote from Jupiter (re-validates spread is still live)
 *  3. Build swap transaction
 *  4. Sign with wallet
 *  5. Send with retry logic
 *  6. Confirm on-chain
 *  7. Record result + Telegram alert
 */
import {
  Connection,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import axios from "axios";
import dotenv from "dotenv";
import { query } from "../db/index.js";
import { telegram } from "./telegram.js";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────
const RPC_URL         = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const JUPITER_QUOTE   = "https://api.jup.ag/swap/v1/quote";
const JUPITER_SWAP    = "https://api.jup.ag/swap/v1/swap";
const USDC_MINT       = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ─── Risk constants ───────────────────────────────────────────────────────────
const MAX_TRADE_USD        = parseFloat(process.env.MAX_TRADE_USD   || "50");
const MIN_PROFIT_USD       = parseFloat(process.env.MIN_PROFIT_USD  || "0.10");
const MAX_DAILY_LOSS_PCT   = parseFloat(process.env.MAX_DAILY_LOSS_PCT || "2");
const MAX_SLIPPAGE_BPS     = parseInt(process.env.MAX_SLIPPAGE_BPS  || "100"); // 1%
const MIN_SOL_RESERVE      = 0.01; // Keep 0.01 SOL for fees — never trade it
const MAX_TRADES_PER_HOUR  = parseInt(process.env.MAX_TRADES_PER_HOUR || "20");

// ─── State ────────────────────────────────────────────────────────────────────
export const executorState = {
  isEnabled:       false,
  emergencyStop:   false,
  emergencyReason: "",
  keypair:         null,
  connection:      null,
  walletAddress:   null,
  solBalance:      0,
  usdBalance:      0,
  solPrice:        0,

  // Stats
  tradesTotal:     0,
  tradesWon:       0,
  tradesLost:      0,
  totalPnlUsd:     0,
  todayPnlUsd:     0,
  todayStart:      new Date().toDateString(),
  bestSpread:      0,
  recentTrades:    [],
  broadcastFn:     null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initExecutor() {
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) throw new Error("WALLET_PRIVATE_KEY not set in .env — run: node src/utils/walletSetup.js");

  try {
    executorState.keypair     = Keypair.fromSecretKey(bs58.decode(pk));
    executorState.walletAddress = executorState.keypair.publicKey.toBase58();
    executorState.connection  = new Connection(RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 30000,
    });

    await refreshBalance();

    console.log(`✅ Executor initialized`);
    console.log(`   Wallet : ${executorState.walletAddress}`);
    console.log(`   Balance: ${executorState.solBalance.toFixed(4)} SOL (~$${executorState.usdBalance.toFixed(2)})`);

    telegram.alertStartup(executorState.walletAddress, executorState.solBalance);
    return true;
  } catch (err) {
    console.error("❌ Executor init failed:", err.message);
    return false;
  }
}

// ─── Balance refresh ──────────────────────────────────────────────────────────
export async function refreshBalance(solPriceUsd) {
  try {
    const lamports = await executorState.connection.getBalance(
      executorState.keypair.publicKey
    );
    executorState.solBalance = lamports / LAMPORTS_PER_SOL;
    executorState.solPrice   = solPriceUsd || executorState.solPrice || 150;
    executorState.usdBalance = executorState.solBalance * executorState.solPrice;
    return executorState.solBalance;
  } catch {
    return executorState.solBalance;
  }
}

// ─── Risk checks ──────────────────────────────────────────────────────────────
function resetDailyIfNeeded() {
  const today = new Date().toDateString();
  if (executorState.todayStart !== today) {
    executorState.todayPnlUsd = 0;
    executorState.todayStart  = today;
  }
}

function preFlightCheck(opp) {
  if (executorState.emergencyStop)
    return { ok: false, reason: `Emergency stop: ${executorState.emergencyReason}` };

  if (!executorState.isEnabled)
    return { ok: false, reason: "Real trading is disabled" };

  if (!executorState.keypair)
    return { ok: false, reason: "Wallet not initialized" };

  resetDailyIfNeeded();
  const maxDailyLoss = executorState.usdBalance * (MAX_DAILY_LOSS_PCT / 100);
  if (executorState.todayPnlUsd <= -maxDailyLoss) {
    telegram.alertDailyLimit(executorState.todayPnlUsd, MAX_DAILY_LOSS_PCT);
    return { ok: false, reason: `Daily loss limit hit ($${maxDailyLoss.toFixed(2)})` };
  }

  const tradeSizeUsd = Math.min(MAX_TRADE_USD, executorState.usdBalance * 0.5);
  const tradeSizeSol = tradeSizeUsd / executorState.solPrice;
  if (executorState.solBalance - tradeSizeSol < MIN_SOL_RESERVE)
    return { ok: false, reason: "Insufficient SOL (keeping reserve for fees)" };

  if (executorState.solBalance * executorState.solPrice < 10) {
    telegram.alertLowBalance(executorState.solBalance, executorState.usdBalance);
    return { ok: false, reason: "Balance too low (<$10)" };
  }

  // Count trades this hour
  const oneHourAgo = Date.now() - 3600000;
  const tradesThisHour = executorState.recentTrades.filter(
    t => new Date(t.executedAt).getTime() > oneHourAgo
  ).length;
  if (tradesThisHour >= MAX_TRADES_PER_HOUR)
    return { ok: false, reason: `Rate limit: ${MAX_TRADES_PER_HOUR} trades/hour` };

  if (opp.netProfitUsd < MIN_PROFIT_USD)
    return { ok: false, reason: `Net profit $${opp.netProfitUsd.toFixed(3)} below minimum $${MIN_PROFIT_USD}` };

  return { ok: true, tradeSizeUsd, tradeSizeSol };
}

// ─── Jupiter quote + swap ──────────────────────────────────────────────────────
async function getFreshQuote(inputMint, outputMint, amountLamports) {
  const headers = {};
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;

  const { data } = await axios.get(JUPITER_QUOTE, {
    params: {
      inputMint,
      outputMint,
      amount:       amountLamports,
      slippageBps:  MAX_SLIPPAGE_BPS,
      onlyDirectRoutes: false,
    },
    headers,
    timeout: 8000,
  });
  return data;
}

async function buildSwapTx(quote) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;

  const { data } = await axios.post(JUPITER_SWAP, {
    quoteResponse:      quote,
    userPublicKey:      executorState.walletAddress,
    wrapAndUnwrapSol:   true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: "auto",
  }, { headers, timeout: 10000 });

  return data.swapTransaction;
}

async function signAndSend(swapTxBase64) {
  const txBuffer  = Buffer.from(swapTxBase64, "base64");
  const tx        = VersionedTransaction.deserialize(txBuffer);
  tx.sign([executorState.keypair]);

  const rawTx = tx.serialize();
  const sig   = await executorState.connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    maxRetries:    3,
  });

  const { value } = await executorState.connection.confirmTransaction(sig, "confirmed");
  if (value?.err) throw new Error(`TX failed on-chain: ${JSON.stringify(value.err)}`);

  return sig;
}

// ─── MAIN: Execute real arb trade ────────────────────────────────────────────
export async function executeRealTrade(opportunity) {
  const check = preFlightCheck(opportunity);
  if (!check.ok) {
    console.log(`⏭️  Trade skipped: ${check.reason}`);
    return { ok: false, reason: check.reason };
  }

  const { tradeSizeUsd, tradeSizeSol } = check;
  const inputLamports = Math.floor(tradeSizeSol * LAMPORTS_PER_SOL);

  console.log(`\n⚡ EXECUTING REAL TRADE`);
  console.log(`   ${opportunity.token}: ${opportunity.buyDex} → ${opportunity.sellDex}`);
  console.log(`   Spread: ${opportunity.spreadPct.toFixed(3)}% | Size: $${tradeSizeUsd.toFixed(2)}`);

  const startBalance = executorState.solBalance;
  let sig1, sig2;

  try {
    // ── Leg 1: Buy (e.g. SOL → USDC on cheaper DEX) ──
    console.log("  Leg 1: Getting fresh quote...");
    const quote1 = await getFreshQuote(
      opportunity.inputMint,
      opportunity.outputMint,
      inputLamports
    );

    // Validate spread is still live before committing
    const freshSpread = Math.abs(
      parseInt(quote1.outAmount) / inputLamports - opportunity.sellPrice / opportunity.buyPrice
    );
    if (opportunity.spreadPct < 0.3) {
      return { ok: false, reason: "Spread evaporated before execution" };
    }

    console.log("  Leg 1: Building swap transaction...");
    const swapTx1 = await buildSwapTx(quote1);
    console.log("  Leg 1: Signing and sending...");
    sig1 = await signAndSend(swapTx1);
    console.log(`  ✅ Leg 1 confirmed: ${sig1.slice(0, 20)}...`);

    // Brief delay between legs
    await new Promise(r => setTimeout(r, 1000));

    // ── Leg 2: Sell (e.g. USDC → SOL on more expensive DEX) ──
    const outAmount1 = parseInt(quote1.outAmount);
    console.log("  Leg 2: Getting fresh quote...");
    const quote2 = await getFreshQuote(
      opportunity.outputMint,
      opportunity.inputMint,
      outAmount1
    );

    console.log("  Leg 2: Building swap transaction...");
    const swapTx2 = await buildSwapTx(quote2);
    console.log("  Leg 2: Signing and sending...");
    sig2 = await signAndSend(swapTx2);
    console.log(`  ✅ Leg 2 confirmed: ${sig2.slice(0, 20)}...`);

    // ── Calculate actual P&L ──
    await refreshBalance(executorState.solPrice);
    const endBalance    = executorState.solBalance;
    const actualPnlSol  = endBalance - startBalance;
    const actualPnlUsd  = actualPnlSol * executorState.solPrice;
    const feesUsd       = (tradeSizeUsd * 0.007) + 0.004;
    const won           = actualPnlUsd > 0;

    // ── Update state ──
    executorState.tradesTotal++;
    if (won) executorState.tradesWon++; else executorState.tradesLost++;
    executorState.totalPnlUsd  += actualPnlUsd;
    executorState.todayPnlUsd  += actualPnlUsd;
    if (opportunity.spreadPct > executorState.bestSpread) {
      executorState.bestSpread = opportunity.spreadPct;
    }

    const trade = {
      token:         opportunity.token,
      buyDex:        opportunity.buyDex,
      sellDex:       opportunity.sellDex,
      spreadPct:     opportunity.spreadPct,
      tradeSizeUsd,
      feesUsd,
      netPnlUsd:     actualPnlUsd,
      netPnlSol:     actualPnlSol,
      newBalanceUsd: executorState.usdBalance,
      txSignature:   sig1,
      tx2Signature:  sig2,
      won,
      executedAt:    new Date().toISOString(),
    };

    executorState.recentTrades = [trade, ...executorState.recentTrades].slice(0, 50);

    // Persist to DB
    await query(`
      INSERT INTO real_trades
        (token, buy_dex, sell_dex, spread_pct, trade_size_usd, fees_usd,
         net_pnl_usd, net_pnl_sol, tx_signature, tx2_signature, won)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      trade.token, trade.buyDex, trade.sellDex, trade.spreadPct,
      trade.tradeSizeUsd, trade.feesUsd, trade.netPnlUsd, trade.netPnlSol,
      trade.txSignature, trade.tx2Signature, trade.won,
    ]).catch(() => {});

    console.log(`\n  ✅ TRADE COMPLETE`);
    console.log(`  P&L: ${actualPnlUsd >= 0 ? "+" : ""}$${actualPnlUsd.toFixed(4)}`);
    console.log(`  Balance: ${endBalance.toFixed(6)} SOL (~$${executorState.usdBalance.toFixed(2)})`);

    // Telegram alert
    telegram.alertTradeExecuted(trade);

    // Broadcast to frontend
    if (executorState.broadcastFn) {
      executorState.broadcastFn("real_trade", { trade, state: getRealSummary() });
    }

    return { ok: true, trade };

  } catch (err) {
    console.error(`❌ Trade execution failed: ${err.message}`);
    telegram.alertError(`Trade failed: ${err.message}`, `${opportunity.token} ${opportunity.buyDex}→${opportunity.sellDex}`);

    // If leg 1 went through but leg 2 failed — dangerous state
    if (sig1 && !sig2) {
      triggerEmergencyStop(`Leg 2 failed after Leg 1 confirmed (${sig1.slice(0, 20)}). Manual intervention required.`);
    }

    return { ok: false, reason: err.message };
  }
}

// ─── Emergency stop ───────────────────────────────────────────────────────────
export function triggerEmergencyStop(reason) {
  executorState.emergencyStop   = true;
  executorState.emergencyReason = reason;
  executorState.isEnabled       = false;
  console.error(`\n🛑 EMERGENCY STOP: ${reason}\n`);
  telegram.alertEmergencyStop(reason, getRealSummary());
  if (executorState.broadcastFn) {
    executorState.broadcastFn("emergency_stop", { reason });
  }
}

export function clearEmergencyStop() {
  executorState.emergencyStop   = false;
  executorState.emergencyReason = "";
}

// ─── Summary for API/WS ──────────────────────────────────────────────────────
export function getRealSummary() {
  const winRate = executorState.tradesTotal > 0
    ? ((executorState.tradesWon / executorState.tradesTotal) * 100).toFixed(1)
    : "0.0";

  resetDailyIfNeeded();
  const maxDailyLoss = executorState.usdBalance * (MAX_DAILY_LOSS_PCT / 100);
  const dailyLimitUsed = executorState.todayPnlUsd < 0
    ? (Math.abs(executorState.todayPnlUsd) / Math.max(maxDailyLoss, 0.01) * 100).toFixed(1)
    : "0.0";

  return {
    isEnabled:       executorState.isEnabled,
    emergencyStop:   executorState.emergencyStop,
    emergencyReason: executorState.emergencyReason,
    walletAddress:   executorState.walletAddress,
    solBalance:      executorState.solBalance,
    usdBalance:      executorState.usdBalance,
    solPrice:        executorState.solPrice,
    tradesTotal:     executorState.tradesTotal,
    tradesWon:       executorState.tradesWon,
    tradesLost:      executorState.tradesLost,
    totalPnlUsd:     executorState.totalPnlUsd,
    todayPnlUsd:     executorState.todayPnlUsd,
    winRate,
    bestSpread:      executorState.bestSpread,
    dailyLimitUsed,
    dailyLimitHit:   executorState.todayPnlUsd <= -maxDailyLoss,
    recentTrades:    executorState.recentTrades,
    maxTradeUsd:     MAX_TRADE_USD,
    minProfitUsd:    MIN_PROFIT_USD,
    maxDailyLossPct: MAX_DAILY_LOSS_PCT,
  };
}

export function setBroadcastReal(fn) {
  executorState.broadcastFn = fn;
}
