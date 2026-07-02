/**
 * src/index.js — Phase 3
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";

import apiRoutes    from "./routes/api.js";
import paperRoutes  from "./routes/paper.js";
import realRoutes   from "./routes/real.js";
import { startScanner, setBroadcast, scannerState } from "./services/scanner.js";
import { setBroadcastPaper, getPaperSummary } from "./services/paperTrading.js";
import { setBroadcastReal, getRealSummary, initExecutor, executorState } from "./services/realExecutor.js";
import { telegram } from "./services/telegram.js";

dotenv.config();

const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 4000;
const FRONTEND   = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: [FRONTEND, "http://localhost:5173"], credentials: true }));
app.use(express.json());

app.use("/api",        apiRoutes);
app.use("/api/paper",  paperRoutes);
app.use("/api/real",   realRoutes);   // ← Phase 3

// Socket.io
const io = new Server(httpServer, {
  cors: { origin: [FRONTEND, "http://localhost:5173"], methods: ["GET", "POST"] },
});

setBroadcast((event, data)     => io.emit(event, data));
setBroadcastPaper((event, data) => io.emit(event, data));
setBroadcastReal((event, data)  => io.emit(event, data));

io.on("connection", (socket) => {
  console.log(chalk.cyan(`  WS connected: ${socket.id}`));
  socket.emit("scan_update", {
    prices: scannerState.latestPrices,
    opportunities: scannerState.latestOpps,
    stats: {
      scansTotal: scannerState.scansTotal,
      oppsFound:  scannerState.oppsFound,
      lastScanAt: scannerState.lastScanAt,
      bestSpreadEver: scannerState.bestSpreadEver,
    },
  });
  socket.emit("paper_state", getPaperSummary());
  socket.emit("real_state",  getRealSummary());
  socket.on("disconnect", () => console.log(chalk.gray(`  WS disconnected: ${socket.id}`)));
});

// Hourly Telegram status report
setInterval(() => {
  if (executorState.isEnabled) {
    const summary = getRealSummary();
    telegram.alertStatus({
      totalPnl:    summary.totalPnlUsd,
      winRate:     summary.winRate,
      tradesTotal: summary.tradesTotal,
      tradesWon:   summary.tradesWon,
      tradesLost:  summary.tradesLost,
      balanceUsd:  summary.usdBalance,
      bestSpread:  summary.bestSpread,
    });
  }
}, 3600000);

httpServer.listen(PORT, async () => {
  console.log(chalk.cyan(`
╔════════════════════════════════════════╗
║   ⚡  ARB BOT — PHASE 3 BACKEND        ║
╠════════════════════════════════════════╣
║  REST  : http://localhost:${PORT}/api       ║
║  Real  : http://localhost:${PORT}/api/real  ║
║  WS    : ws://localhost:${PORT}             ║
╚════════════════════════════════════════╝
  `));

  // Try to init wallet if key is present (non-blocking)
  if (process.env.WALLET_PRIVATE_KEY) {
    await initExecutor().catch(() => {});
  } else {
    console.log(chalk.yellow("  ⚠️  No WALLET_PRIVATE_KEY — run: node src/utils/walletSetup.js"));
  }

  startScanner();
});

process.on("SIGINT", () => { console.log(chalk.yellow("\nShutting down...")); process.exit(0); });
