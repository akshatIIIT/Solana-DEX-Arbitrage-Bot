/**
 * hooks/useScanner.js — UPDATED for Phase 2
 * Exposes the socket instance so usePaper can share it
 */
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND = "http://localhost:4000";

const INITIAL_STATE = {
  prices: {},
  opportunities: [],
  stats: { scansTotal: 0, oppsFound: 0, lastScanAt: null, scanMs: 0, bestSpreadEver: 0 },
  connected: false,
  history: [],
};

export function useScanner() {
  const [state, setState] = useState(INITIAL_STATE);
  const [socket, setSocket] = useState(null);
  const historyRef = useRef([]);

  useEffect(() => {
    const s = io(BACKEND, { transports: ["websocket"] });
    setSocket(s);

    s.on("connect",    () => setState(p => ({ ...p, connected: true })));
    s.on("disconnect", () => setState(p => ({ ...p, connected: false })));

    s.on("scan_update", (data) => {
      const point = {
        ts: Date.now(),
        ...Object.fromEntries(
          Object.entries(data.prices || {}).map(([token, sources]) => [
            token,
            sources.jupiter ?? sources.raydium ?? sources.orca ?? 0,
          ])
        ),
      };
      historyRef.current = [...historyRef.current.slice(-119), point];
      setState(p => ({
        ...p,
        prices: data.prices || {},
        opportunities: data.opportunities || [],
        stats: data.stats || p.stats,
        history: historyRef.current,
      }));
    });

    return () => s.disconnect();
  }, []);

  return { ...state, socket };
}
