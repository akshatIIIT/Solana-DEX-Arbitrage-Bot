/**
 * services/jupiterService.js
 * Multi-source price fetcher — covers ALL 5 tokens including JUP + PYTH
 *
 * Sources tried in order:
 *  1. Jupiter v3 API       (all tokens, needs free key from portal.jup.ag)
 *  2. CoinGecko            (all 5 tokens, free, rate-limited)
 *  3. Binance              (SOL, BONK, WIF — no JUP/PYTH)
 *  4. Kraken               (SOL, fills gap)
 *  5. KuCoin               (JUP, PYTH — fills gap)
 *  6. Bitget               (JUP, PYTH — fills gap)
 */
import axios from "axios";

const JUPITER_PRICE_V3 = "https://api.jup.ag/price/v3";
const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1/quote";

export const TOKEN_MINTS = {
  SOL:  "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF:  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

export const TRACKED_TOKENS = Object.keys(TOKEN_MINTS).filter(t => t !== "USDC");

// ─── Source 1: Jupiter v3 (needs free key) ───────────────────────────────────
async function fromJupiter() {
  if (!process.env.JUPITER_API_KEY) return null;
  const mintIds = TRACKED_TOKENS.map(t => TOKEN_MINTS[t]).join(",");
  const { data } = await axios.get(JUPITER_PRICE_V3, {
    params: { ids: mintIds },
    headers: { "x-api-key": process.env.JUPITER_API_KEY },
    timeout: 7000,
  });
  const prices = {};
  for (const token of TRACKED_TOKENS) {
    const entry = data?.data?.[TOKEN_MINTS[token]];
    const price = entry?.usdPrice ?? entry?.price;
    if (price) prices[token] = { price: parseFloat(price), source: "jupiter" };
  }
  return Object.keys(prices).length >= 3 ? prices : null;
}

// ─── Source 2: CoinGecko (free, all 5 tokens) ────────────────────────────────
async function fromCoinGecko() {
  const { data } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price",
    {
      params: {
        ids: "solana,bonk,jupiter-exchange-solana,dogwifcoin,pyth-network",
        vs_currencies: "usd",
      },
      timeout: 8000,
    }
  );
  const map = {
    SOL:  data?.["solana"]?.usd,
    BONK: data?.["bonk"]?.usd,
    JUP:  data?.["jupiter-exchange-solana"]?.usd,
    WIF:  data?.["dogwifcoin"]?.usd,
    PYTH: data?.["pyth-network"]?.usd,
  };
  const prices = {};
  for (const [token, price] of Object.entries(map)) {
    if (price) prices[token] = { price, source: "coingecko" };
  }
  return Object.keys(prices).length >= 3 ? prices : null;
}

// ─── Source 3: Binance (SOL, BONK, WIF — no JUP/PYTH) ───────────────────────
async function fromBinance() {
  const symbols = ["SOLUSDT", "BONKUSDT", "WIFUSDT", "JUPUSDT", "PYTHUSDT"];
  const { data } = await axios.get("https://api.binance.com/api/v3/ticker/price", {
    params: { symbols: JSON.stringify(symbols) },
    timeout: 6000,
  });
  const symbolMap = {
    SOLUSDT: "SOL", BONKUSDT: "BONK", WIFUSDT: "WIF",
    JUPUSDT: "JUP", PYTHUSDT: "PYTH",
  };
  const prices = {};
  for (const item of Array.isArray(data) ? data : []) {
    const token = symbolMap[item.symbol];
    if (token && item.price && parseFloat(item.price) > 0) {
      prices[token] = { price: parseFloat(item.price), source: "binance" };
    }
  }
  return Object.keys(prices).length >= 1 ? prices : null;
}

// ─── Source 4: KuCoin (has JUP and PYTH) ─────────────────────────────────────
async function fromKuCoin() {
  // KuCoin supports bulk ticker
  const pairs = ["JUP-USDT", "PYTH-USDT", "SOL-USDT", "WIF-USDT"];
  const results = await Promise.allSettled(
    pairs.map(symbol =>
      axios.get("https://api.kucoin.com/api/v1/market/orderbook/level1", {
        params: { symbol },
        timeout: 6000,
      })
    )
  );
  const symbolMap = {
    "JUP-USDT": "JUP", "PYTH-USDT": "PYTH",
    "SOL-USDT": "SOL", "WIF-USDT": "WIF",
  };
  const prices = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const price = parseFloat(r.value.data?.data?.price);
      const token = symbolMap[pairs[i]];
      if (token && price > 0) prices[token] = { price, source: "kucoin" };
    }
  });
  return Object.keys(prices).length >= 1 ? prices : null;
}

// ─── Source 5: Kraken (reliable for SOL) ─────────────────────────────────────
async function fromKraken() {
  const { data } = await axios.get("https://api.kraken.com/0/public/Ticker", {
    params: { pair: "SOLUSD,JUPUSD,PYTHUSD" },
    timeout: 6000,
  });
  const prices = {};
  const result = data?.result || {};
  const krakenMap = { SOL: ["SOLUSD", "XSOLUSD"], JUP: ["JUPUSD"], PYTH: ["PYTHUSD"] };
  for (const [token, keys] of Object.entries(krakenMap)) {
    for (const key of keys) {
      if (result[key]) {
        const price = parseFloat(result[key]?.c?.[0]);
        if (price > 0) { prices[token] = { price, source: "kraken" }; break; }
      }
    }
  }
  return Object.keys(prices).length >= 1 ? prices : null;
}

// ─── Source 6: Bitget (backup for JUP/PYTH) ──────────────────────────────────
async function fromBitget() {
  const symbols = ["JUPUSDT", "PYTHUSDT", "SOLUSDT", "WIFUSDT"];
  const results = await Promise.allSettled(
    symbols.map(symbol =>
      axios.get("https://api.bitget.com/api/v2/spot/market/tickers", {
        params: { symbol },
        timeout: 6000,
      })
    )
  );
  const symbolMap = {
    JUPUSDT: "JUP", PYTHUSDT: "PYTH", SOLUSDT: "SOL", WIFUSDT: "WIF",
  };
  const prices = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const item = r.value.data?.data?.[0];
      const price = parseFloat(item?.lastPr || item?.close || 0);
      const token = symbolMap[symbols[i]];
      if (token && price > 0) prices[token] = { price, source: "bitget" };
    }
  });
  return Object.keys(prices).length >= 1 ? prices : null;
}

// ─── MAIN: Try all sources, merge results ────────────────────────────────────
export async function getJupiterPrices() {
  const sources = [
    { name: "Jupiter",  fn: fromJupiter },
    { name: "CoinGecko", fn: fromCoinGecko },
    { name: "Binance",  fn: fromBinance },
    { name: "KuCoin",   fn: fromKuCoin },
    { name: "Kraken",   fn: fromKraken },
    { name: "Bitget",   fn: fromBitget },
  ];

  const merged = {};

  for (const { name, fn } of sources) {
    // Skip if we already have all tokens
    if (TRACKED_TOKENS.every(t => merged[t])) break;

    try {
      const result = await fn();
      if (!result) continue;
      for (const [token, data] of Object.entries(result)) {
        if (!merged[token]) merged[token] = data; // first source wins
      }
    } catch (err) {
      // silent — try next source
    }
  }

  const found = Object.keys(merged);
  const missing = TRACKED_TOKENS.filter(t => !merged[t]);

  if (found.length > 0) {
    const bySource = {};
    for (const [t, d] of Object.entries(merged)) {
      bySource[d.source] = bySource[d.source] || [];
      bySource[d.source].push(t);
    }
    const summary = Object.entries(bySource).map(([s, ts]) => `${s}(${ts.join(",")})`).join(" | ");
    console.log(`✅ Prices: ${summary}${missing.length ? ` | ❌ missing: ${missing.join(",")}` : ""}`);
  } else {
    console.error("❌ All price sources failed");
  }

  return merged;
}

// ─── DEX Quote via Jupiter swap API ──────────────────────────────────────────
export async function getDexQuotePrice(inputMint, outputMint, amountIn, dexLabel) {
  try {
    const headers = {};
    if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
    const { data } = await axios.get(JUPITER_QUOTE_API, {
      params: { inputMint, outputMint, amount: amountIn, slippageBps: 50, onlyDirectRoutes: true, dexes: dexLabel },
      headers,
      timeout: 6000,
    });
    if (!data?.outAmount) return null;
    return {
      price: parseInt(data.outAmount) / amountIn,
      outAmount: parseInt(data.outAmount),
      priceImpactPct: parseFloat(data.priceImpactPct || 0),
      route: data.routePlan?.[0]?.swapInfo?.label || dexLabel,
    };
  } catch {
    return null;
  }
}
