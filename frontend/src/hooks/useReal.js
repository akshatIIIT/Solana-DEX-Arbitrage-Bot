/**
 * hooks/useReal.js
 * Phase 3 real trading state via WebSocket + REST
 */
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "http://localhost:4000/api/real";

const INITIAL = {
  isEnabled: false, emergencyStop: false, emergencyReason: "",
  walletAddress: null, solBalance: 0, usdBalance: 0, solPrice: 0,
  tradesTotal: 0, tradesWon: 0, tradesLost: 0,
  totalPnlUsd: 0, todayPnlUsd: 0, winRate: "0.0",
  bestSpread: 0, dailyLimitUsed: "0.0", dailyLimitHit: false,
  recentTrades: [], maxTradeUsd: 50, minProfitUsd: 0.10, maxDailyLossPct: 2,
};

export function useReal(socket) {
  const [real, setReal] = useState(INITIAL);

  useEffect(() => {
    axios.get(`${API}/status`).then(r => setReal(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("real_state", setReal);
    socket.on("real_trade", ({ state }) => setReal(state));
    socket.on("emergency_stop", ({ reason }) =>
      setReal(p => ({ ...p, emergencyStop: true, emergencyReason: reason, isEnabled: false }))
    );
    return () => {
      socket.off("real_state");
      socket.off("real_trade");
      socket.off("emergency_stop");
    };
  }, [socket]);

  const enable = useCallback(async () => {
    const { data } = await axios.post(`${API}/enable`, { confirmed: true });
    setReal(data);
    return data;
  }, []);

  const disable = useCallback(async () => {
    await axios.post(`${API}/disable`);
    setReal(p => ({ ...p, isEnabled: false }));
  }, []);

  const emergencyStop = useCallback(async (reason) => {
    await axios.post(`${API}/emergency-stop`, { reason });
    setReal(p => ({ ...p, emergencyStop: true, isEnabled: false }));
  }, []);

  const clearEmergency = useCallback(async () => {
    await axios.post(`${API}/clear-emergency`);
    setReal(p => ({ ...p, emergencyStop: false, emergencyReason: "" }));
  }, []);

  const testTelegram = useCallback(async () => {
    const { data } = await axios.post(`${API}/test-telegram`);
    return data;
  }, []);

  const manualTrade = useCallback(async (opp) => {
    const { data } = await axios.post(`${API}/execute`, { opportunity: opp });
    return data;
  }, []);

  return { real, enable, disable, emergencyStop, clearEmergency, testTelegram, manualTrade };
}
