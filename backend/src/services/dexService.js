/**
 * services/dexService.js
 * Raydium + Orca prices — fixed incorrect pool price mapping
 *
 * Root cause of wrong Orca prices:
 *   GeckoTerminal pool endpoint returns base_token_price_usd which may be
 *   the OTHER token in the pair. Fix: use token_price endpoint by mint address
 *   which returns the correct USD price for that exact token — no pool confusion.
 */
import axios from "axios";
import { TOKEN_MINTS, TRACKED_TOKENS } from "./jupiterService.js";

// ─────────────────────────────────────────
//   RAYDIUM
// ─────────────────────────────────────────
export async function getRaydiumPrices() {
  try {
    const mints = TRACKED_TOKENS.map(t => TOKEN_MINTS[t]).join(",");
    const { data } = await axios.get("https://api-v3.raydium.io/mint/price", {
      params: { mints },
      timeout: 7000,
    });
    const prices = {};
    for (const token of TRACKED_TOKENS) {
      const price = parseFloat(data?.data?.[TOKEN_MINTS[token]]);
      if (price > 0) prices[token] = { price, source: "raydium" };
    }
    return prices;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────
//   SANITY BOUNDS — reject obviously wrong prices
// ─────────────────────────────────────────
const PRICE_BOUNDS = {
  SOL:  [20,    1000],
  BONK: [0.000001, 0.01],
  JUP:  [0.01,  20],
  WIF:  [0.01,  20],
  PYTH: [0.005, 10],
};

function isValidPrice(token, price) {
  const bounds = PRICE_BOUNDS[token];
  if (!bounds) return price > 0;
  return price >= bounds[0] && price <= bounds[1];
}

// ─────────────────────────────────────────
//   ORCA — GeckoTerminal token_price endpoint
//   Uses mint address directly → correct USD price, no pool confusion
// ─────────────────────────────────────────
let orcaCache = { prices: {}, ts: 0 };
const ORCA_CACHE_TTL = 20000;

export async function getOrcaPrices() {
  if (Date.now() - orcaCache.ts < ORCA_CACHE_TTL && Object.keys(orcaCache.prices).length > 0) {
    return orcaCache.prices;
  }

  const prices = {};

  // Strategy 1: GeckoTerminal token_price by mint — correct USD per token
  try {
    const mintList = TRACKED_TOKENS.map(t => TOKEN_MINTS[t]).join(",");
    const { data } = await axios.get(
      `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${mintList}`,
      {
        timeout: 8000,
        headers: { Accept: "application/json;version=20230302" },
      }
    );

    const tokenPrices = data?.data?.attributes?.token_prices || {};
    for (const token of TRACKED_TOKENS) {
      const price = parseFloat(tokenPrices[TOKEN_MINTS[token]]);
      if (price > 0 && isValidPrice(token, price)) {
        prices[token] = { price, source: "orca" };
      } else if (price > 0) {
        console.warn(`  ⚠️  Orca/GeckoTerminal ${token} price $${price} out of bounds — rejected`);
      }
    }
  } catch (err) {
    console.error("GeckoTerminal token_price failed:", err.message);
  }

  // Strategy 2: Orca whirlpool list — fills missing tokens only
  const missing = TRACKED_TOKENS.filter(t => !prices[t]);
  if (missing.length > 0) {
    try {
      const { data } = await axios.get(
        "https://api.mainnet.orca.so/v1/whirlpool/list",
        { timeout: 8000 }
      );
      const pools = data?.whirlpools || [];

      for (const token of missing) {
        const mint = TOKEN_MINTS[token];
        // Only USDC-paired pools for reliable USD price
        const pool = pools.find(p =>
          (p.tokenA?.mint === mint      && p.tokenB?.mint === TOKEN_MINTS.USDC) ||
          (p.tokenB?.mint === mint      && p.tokenA?.mint === TOKEN_MINTS.USDC)
        );
        if (!pool?.price) continue;

        let price = parseFloat(pool.price);
        // pool.price = tokenA per tokenB
        // If USDC is tokenA: price = USDC/TOKEN, invert to get TOKEN in USD
        if (pool.tokenA?.mint === TOKEN_MINTS.USDC) price = 1 / price;

        if (isValidPrice(token, price)) {
          prices[token] = { price, source: "orca" };
        } else {
          console.warn(`  ⚠️  Orca whirlpool ${token} price $${price} out of bounds — rejected`);
        }
      }
    } catch (err) {
      console.error("Orca whirlpool fallback failed:", err.message);
    }
  }

  orcaCache = { prices, ts: Date.now() };
  return prices;
}

// ─────────────────────────────────────────
//   FETCH ALL + CROSS-VALIDATE
// ─────────────────────────────────────────
export async function getAllDexPrices() {
  const [raydiumResult, orcaResult] = await Promise.allSettled([
    getRaydiumPrices(),
    getOrcaPrices(),
  ]);

  const raydium = raydiumResult.status === "fulfilled" ? raydiumResult.value : {};
  const orca    = orcaResult.status    === "fulfilled" ? orcaResult.value    : {};

  // Cross-validate: if Raydium and Orca differ by >5% flag it, >20% reject Orca
  for (const token of TRACKED_TOKENS) {
    const r = raydium[token]?.price;
    const o = orca[token]?.price;
    if (!r || !o) continue;

    const diffPct = Math.abs(r - o) / Math.min(r, o) * 100;

    if (diffPct > 20) {
      console.warn(`  🚫 ${token}: Orca $${o.toFixed(6)} vs Raydium $${r.toFixed(6)} = ${diffPct.toFixed(1)}% diff — Orca price REJECTED`);
      delete orca[token]; // Remove bad Orca price rather than show fake spread
    } else if (diffPct > 5) {
      console.warn(`  ⚠️  ${token}: ${diffPct.toFixed(1)}% spread Raydium/Orca — real opp or stale data, verify manually`);
    }
  }

  console.log(
    `  DEX — Raydium: [${Object.keys(raydium).join(",") || "none"}]` +
    ` | Orca: [${Object.keys(orca).join(",") || "none"}]`
  );

  return { raydium, orca };
}
