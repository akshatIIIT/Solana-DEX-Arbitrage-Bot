# ⚡ Solana Arb Bot — Full Stack Platform

Production-grade arbitrage scanner with React dashboard + Node.js backend + PostgreSQL.

```
arb-platform/
├── backend/     ← Node.js + Express + Socket.io scanner
└── frontend/    ← React + Tailwind dashboard
```

---

## 🎥 Demo

▶️ **[Watch Demo Video](https://github.com/user-attachments/assets/f02cd8d3-2f51-4e72-b2d2-18e3a8173e4d)**

## 🚀 Setup (Two Terminals)

### Prerequisites
- Node.js 18+  →  https://nodejs.org
- PostgreSQL   →  https://www.postgresql.org/download/
  - OR free cloud DB: https://neon.tech (easier, no local install)

---

### Terminal 1 — Backend

```bash
cd backend
npm install
```

**Set up your database:**

Option A — Local PostgreSQL:
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE arbbot;"

# Then in .env set:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/arbbot
```

Option B — Neon.tech (free, no install):
1. Sign up at https://neon.tech
2. Create a project → copy the connection string
3. Paste into .env as DATABASE_URL

**Create tables:**
```bash
node src/db/setup.js
```

**Start backend:**
```bash
npm run dev
```

Backend runs at: http://localhost:4000

---

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard opens at: http://localhost:3000

---

## 📊 Dashboard Features

| Tab | What you see |
|-----|-------------|
| **Scanner** | Live price table (Jupiter/Raydium/Orca) + opportunity feed |
| **Charts** | Real-time price history chart + spread bar chart per token |
| **History** | Full opportunity log with profit/loss breakdown |

---

## ⚙️ Configuration (backend/.env)

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SCAN_INTERVAL_MS` | `2000` | Scan every 2 seconds |
| `MIN_SPREAD_PCT` | `0.3` | Minimum spread to flag as viable |
| `RPC_URL` | mainnet public | Use Helius for higher rate limits |

---

## 🗺️ Architecture

```
Frontend (React)
  │  WebSocket (Socket.io)
  │  REST API (Axios)
  ▼
Backend (Node.js / Express)
  │
  ├── Scanner (every 2s)
  │     ├── Jupiter Price API  ← aggregated best price
  │     ├── Raydium API        ← DEX-specific price
  │     └── Orca API           ← DEX-specific price
  │
  ├── Arbitrage Engine
  │     ├── Calculate spreads
  │     ├── Estimate fees (trading + slippage + network)
  │     └── Flag viable opportunities
  │
  └── PostgreSQL
        ├── price_snapshots   ← every price tick
        ├── opportunities     ← every detected spread
        └── paper_trades      ← Phase 2
```

---

## 🗓️ Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Built | Scanner + Dashboard |
| **Phase 2** | 🔜 Next | Paper trading simulator |
| **Phase 3** | 🔜 Later | Real execution (after weeks of paper trading) |

---

## 🛠️ API Endpoints

```
GET  /api/status                  Scanner state + live prices
GET  /api/opportunities?limit=50  Historical opportunities
GET  /api/prices/:token           Price history for a token
GET  /api/stats/summary           24h stats summary
POST /api/scanner/start           Start scanner
POST /api/scanner/stop            Stop scanner
```

---

