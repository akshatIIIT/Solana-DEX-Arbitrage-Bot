/**
 * hooks/usePaper.js
 * Manages paper trading state via WebSocket + REST
 */
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "http://localhost:4000/api/paper";

export function usePaper(socket) {
  const [paper, setPaper] = useState({
    isEnabled: false,
    autoMode: false,
    balance: 0,
    startBalance: 0,
    tradeSize: 1000,
    totalPnl: 0,
    todayPnl: 0,
    pnlPct: "0.00",
    tradesTotal: 0,
    tradesWon: 0,
    tradesLost: 0,
    winRate: "0.0",
    dailyLimitUsed: "0.0",
    dailyLimitHit: false,
    recentTrades: [],
  });

  // Fetch initial state
  useEffect(() => {
    axios.get(`${API}/status`).then(r => setPaper(r.data)).catch(() => {});
  }, []);

  // Live updates from socket
  useEffect(() => {
    if (!socket) return;

    socket.on("paper_state", (data) => setPaper(data));
    socket.on("paper_trade", ({ state }) => setPaper(state));

    return () => {
      socket.off("paper_state");
      socket.off("paper_trade");
    };
  }, [socket]);

  const enable = useCallback(async ({ balance, tradeSize, autoMode }) => {
    const { data } = await axios.post(`${API}/enable`, { balance, tradeSize, autoMode });
    setPaper(data);
    return data;
  }, []);

  const disable = useCallback(async () => {
    await axios.post(`${API}/disable`);
    setPaper(p => ({ ...p, isEnabled: false }));
  }, []);

  const setMode = useCallback(async (autoMode) => {
    await axios.post(`${API}/mode`, { autoMode });
    setPaper(p => ({ ...p, autoMode }));
  }, []);

  const manualExecute = useCallback(async (opportunity) => {
    const { data } = await axios.post(`${API}/execute`, { opportunity });
    return data;
  }, []);

  const reset = useCallback(async (balance) => {
    const { data } = await axios.post(`${API}/reset`, { balance });
    setPaper(data);
  }, []);

  return { paper, enable, disable, setMode, manualExecute, reset };
}
