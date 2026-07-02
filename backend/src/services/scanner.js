/**
 * services/scanner.js — UPDATED for Phase 3
 * Hooks into real executor when enabled
 */
import { getJupiterPrices, TRACKED_TOKENS, TOKEN_MINTS } from "./jupiterService.js";
import { getAllDexPrices } from "./dexService.js";
import { query } from "../db/index.js";
import { onViableOpportunity } from "./paperTrading.js";
import { executeRealTrade, executorState, refreshBalance } from "./realExecutor.js";
import { telegram } from "./telegram.js";

const FEE_OVERHEAD_PCT = 0.007;
const NETWORK_FEE_USD  = 0.004;

export const scannerState = {
  isRunning: false,
  lastScanAt: null,
  scansTotal: 0,
  oppsFound: 0,
  startedAt: null,
  latestPrices: {},
  latestOpps: [],
  bestSpreadEver: 0,
};

let scannerInterval = null;
let broadcastFn = null;

export function setBroadcast(fn) { broadcastFn = fn; }

// Token mint map for execution
const DEX_MINTS = {
  SOL:  { input: TOKEN_MINTS.SOL,  output: TOKEN_MINTS.USDC, inputDec: 9,  outputDec: 6 },
  BONK: { input: TOKEN_MINTS.BONK, output: TOKEN_MINTS.USDC, inputDec: 5,  outputDec: 6 },
  JUP:  { input: TOKEN_MINTS.JUP,  output: TOKEN_MINTS.USDC, inputDec: 6,  outputDec: 6 },
  WIF:  { input: TOKEN_MINTS.WIF,  output: TOKEN_MINTS.USDC, inputDec: 6,  outputDec: 6 },
  PYTH: { input: TOKEN_MINTS.PYTH, output: TOKEN_MINTS.USDC, inputDec: 6,  outputDec: 6 },
};

async function runScan() {
  const scanStart = Date.now();

  const [jupiterPrices, { raydium, orca }] = await Promise.all([
    getJupiterPrices(),
    getAllDexPrices(),
  ]);

  // Refresh sol balance for executor every 10 scans
  if (scannerState.scansTotal % 10 === 0 && executorState.keypair) {
    const solPrice = jupiterPrices?.SOL?.price;
    await refreshBalance(solPrice).catch(() => {});
  }

  const priceMap = {};
  for (const token of TRACKED_TOKENS) {
    priceMap[token] = {};
    if (jupiterPrices[token]) priceMap[token].jupiter = jupiterPrices[token].price;
    if (raydium[token])       priceMap[token].raydium  = raydium[token].price;
    if (orca[token])          priceMap[token].orca     = orca[token].price;
  }
  scannerState.latestPrices = priceMap;

  // Store snapshots
  const vals = [], params = [];
  let idx = 1;
  for (const token of TRACKED_TOKENS) {
    for (const [source, price] of Object.entries(priceMap[token] || {})) {
      vals.push(`($${idx++},$${idx++},$${idx++})`);
      params.push(token, source, price);
    }
  }
  if (vals.length) {
    await query(
      `INSERT INTO price_snapshots (token, source, price_usd) VALUES ${vals.join(",")}`,
      params
    ).catch(() => {});
  }

  // Detect opportunities
  const opportunities = [];
  const TRADE_SIZE_USD = 1000;
  const solPrice = jupiterPrices?.SOL?.price || executorState.solPrice || 150;

  for (const token of TRACKED_TOKENS) {
    const sources = Object.entries(priceMap[token] || {});
    if (sources.length < 2) continue;

    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const [srcA, priceA] = sources[i];
        const [srcB, priceB] = sources[j];
        const low  = priceA < priceB ? [srcA, priceA] : [srcB, priceB];
        const high = priceA > priceB ? [srcA, priceA] : [srcB, priceB];
        const [buyDex, buyPrice]   = low;
        const [sellDex, sellPrice] = high;

        const spreadPct   = ((sellPrice - buyPrice) / buyPrice) * 100;
        if (spreadPct <= 0) continue;

        const grossProfit = (spreadPct / 100) * TRADE_SIZE_USD;
        const fees        = (FEE_OVERHEAD_PCT * TRADE_SIZE_USD) + NETWORK_FEE_USD;
        const netProfit   = grossProfit - fees;
        const minSpread   = parseFloat(process.env.MIN_SPREAD_PCT || "0.3");
        const isViable    = spreadPct >= minSpread && netProfit > 0;
        const mints       = DEX_MINTS[token];

        const opp = {
          token, buyDex, sellDex, buyPrice, sellPrice,
          spreadPct:      parseFloat(spreadPct.toFixed(4)),
          grossProfitUsd: parseFloat(grossProfit.toFixed(4)),
          feesEstimated:  parseFloat(fees.toFixed(4)),
          netProfitUsd:   parseFloat(netProfit.toFixed(4)),
          tradeSizeUsd:   TRADE_SIZE_USD,
          isViable,
          inputMint:      mints?.input,
          outputMint:     mints?.output,
          detectedAt:     new Date().toISOString(),
        };

        opportunities.push(opp);

        if (isViable) {
          if (spreadPct > scannerState.bestSpreadEver) scannerState.bestSpreadEver = spreadPct;

          // Phase 2: paper trading hook
          onViableOpportunity(opp).catch(() => {});

          // Phase 3: real trading hook
          if (executorState.isEnabled && !executorState.emergencyStop) {
            // Send Telegram alert for big spreads
            if (spreadPct >= 1.0) telegram.alertOpportunity(opp);
            executeRealTrade(opp).catch(err => {
              console.error("Real trade error:", err.message);
            });
          }
        }
      }
    }
  }

  opportunities.sort((a, b) => b.spreadPct - a.spreadPct);

  for (const opp of opportunities.slice(0, 20)) {
    await query(
      `INSERT INTO opportunities
         (token, buy_dex, sell_dex, buy_price, sell_price, spread_pct,
          gross_profit_usd, net_profit_usd, fees_estimated, trade_size_usd, is_viable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [opp.token, opp.buyDex, opp.sellDex, opp.buyPrice, opp.sellPrice, opp.spreadPct,
       opp.grossProfitUsd, opp.netProfitUsd, opp.feesEstimated, opp.tradeSizeUsd, opp.isViable]
    ).catch(() => {});
  }

  scannerState.scansTotal++;
  scannerState.oppsFound += opportunities.filter(o => o.isViable).length;
  scannerState.lastScanAt = new Date().toISOString();
  scannerState.latestOpps = opportunities.slice(0, 10);

  const scanMs = Date.now() - scanStart;

  if (broadcastFn) {
    broadcastFn("scan_update", {
      prices: priceMap,
      opportunities: opportunities.slice(0, 10),
      stats: {
        scansTotal: scannerState.scansTotal,
        oppsFound:  scannerState.oppsFound,
        lastScanAt: scannerState.lastScanAt,
        scanMs,
        bestSpreadEver: scannerState.bestSpreadEver,
      },
    });
  }
}

export function startScanner() {
  if (scannerState.isRunning) return;
  const interval = parseInt(process.env.SCAN_INTERVAL_MS || "5000");
  scannerState.isRunning = true;
  scannerState.startedAt = new Date().toISOString();
  console.log(`🔍 Scanner started — every ${interval}ms`);
  runScan().catch(console.error);
  scannerInterval = setInterval(() => runScan().catch(console.error), interval);
}

export function stopScanner() {
  if (scannerInterval) { clearInterval(scannerInterval); scannerInterval = null; }
  scannerState.isRunning = false;
}
