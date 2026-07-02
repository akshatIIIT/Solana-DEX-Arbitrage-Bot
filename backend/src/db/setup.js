/**
 * db/setup.js — Creates all tables
 * Run once: node src/db/setup.js
 */
import { pool } from "./index.js";

const schema = `
-- Price snapshots from each DEX
CREATE TABLE IF NOT EXISTS price_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  token        VARCHAR(20) NOT NULL,
  source       VARCHAR(20) NOT NULL,   -- 'jupiter', 'raydium', 'orca'
  price_usd    NUMERIC(20, 8) NOT NULL,
  liquidity    NUMERIC(30, 2),
  volume_24h   NUMERIC(30, 2),
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_token_time
  ON price_snapshots(token, fetched_at DESC);

-- Arbitrage opportunities detected
CREATE TABLE IF NOT EXISTS opportunities (
  id           BIGSERIAL PRIMARY KEY,
  token        VARCHAR(20) NOT NULL,
  buy_dex      VARCHAR(20) NOT NULL,
  sell_dex     VARCHAR(20) NOT NULL,
  buy_price    NUMERIC(20, 8) NOT NULL,
  sell_price   NUMERIC(20, 8) NOT NULL,
  spread_pct   NUMERIC(10, 4) NOT NULL,
  gross_profit_usd  NUMERIC(20, 4),
  net_profit_usd    NUMERIC(20, 4),
  trade_size_usd    NUMERIC(20, 2) DEFAULT 1000,
  fees_estimated    NUMERIC(20, 4),
  is_viable    BOOLEAN DEFAULT FALSE,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opps_token_time
  ON opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_opps_viable
  ON opportunities(is_viable, detected_at DESC);

-- Paper trades (Phase 2)
CREATE TABLE IF NOT EXISTS paper_trades (
  id           BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT REFERENCES opportunities(id),
  token        VARCHAR(20) NOT NULL,
  buy_dex      VARCHAR(20) NOT NULL,
  sell_dex     VARCHAR(20) NOT NULL,
  trade_size_usd  NUMERIC(20, 2) NOT NULL,
  entry_price  NUMERIC(20, 8) NOT NULL,
  exit_price   NUMERIC(20, 8) NOT NULL,
  gross_pnl    NUMERIC(20, 4),
  fees_paid    NUMERIC(20, 4),
  net_pnl      NUMERIC(20, 4),
  status       VARCHAR(20) DEFAULT 'open',  -- open, closed, cancelled
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at    TIMESTAMPTZ
);

-- System stats (summary materialized rows)
CREATE TABLE IF NOT EXISTS scanner_stats (
  id           SERIAL PRIMARY KEY,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scans_total  BIGINT DEFAULT 0,
  opps_found   BIGINT DEFAULT 0,
  best_spread  NUMERIC(10,4),
  tokens_tracked INT
);
`;

async function setup() {
  console.log("Setting up database...");
  try {
    await pool.query(schema);
    console.log("✅ All tables created successfully.");
  } catch (err) {
    console.error("❌ DB setup failed:", err.message);
    console.log("\nMake sure PostgreSQL is running and DATABASE_URL in .env is correct.");
    console.log("Quick setup: brew install postgresql && brew services start postgresql");
    console.log("Or use free cloud DB: https://neon.tech\n");
  } finally {
    await pool.end();
  }
}

setup();
