/**
 * db/migrate_phase3.js
 * Adds real_trades table for Phase 3.
 * Run: node src/db/migrate_phase3.js
 */
import { pool } from "./index.js";

const sql = `
CREATE TABLE IF NOT EXISTS real_trades (
  id              BIGSERIAL PRIMARY KEY,
  token           VARCHAR(20) NOT NULL,
  buy_dex         VARCHAR(20) NOT NULL,
  sell_dex        VARCHAR(20) NOT NULL,
  spread_pct      NUMERIC(10, 4) NOT NULL,
  trade_size_usd  NUMERIC(20, 2) NOT NULL,
  fees_usd        NUMERIC(20, 4),
  net_pnl_usd     NUMERIC(20, 4),
  net_pnl_sol     NUMERIC(20, 8),
  tx_signature    VARCHAR(120),
  tx2_signature   VARCHAR(120),
  won             BOOLEAN DEFAULT FALSE,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_trades_time ON real_trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_trades_token ON real_trades(token, executed_at DESC);
`;

async function migrate() {
  console.log("Running Phase 3 migration...");
  try {
    await pool.query(sql);
    console.log("✅ real_trades table created.");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
