/**
 * components/TradeHistory.jsx
 * Live trade feed with PnL per trade
 */
import React from "react";
import { TrendingUp, TrendingDown, Zap, Hand } from "lucide-react";

export function TradeHistory({ trades }) {
  if (!trades?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm gap-2">
        <TrendingUp size={24} strokeWidth={1} />
        No trades yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-80 scrollbar-thin space-y-1.5 pr-1">
      {trades.map((t, i) => (
        <div
          key={t.id || i}
          className={`rounded-lg border px-3 py-2.5 transition-all ${
            t.won
              ? "border-green-800/40 bg-green-900/10"
              : "border-red-800/40 bg-red-900/10"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Left: token + route */}
            <div className="flex items-center gap-2 min-w-0">
              {t.won
                ? <TrendingUp size={13} className="text-green-400 shrink-0" />
                : <TrendingDown size={13} className="text-red-400 shrink-0" />
              }
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                t.won ? "bg-green-700/40 text-green-300" : "bg-red-700/40 text-red-300"
              }`}>
                {t.token}
              </span>
              <span className="text-xs text-gray-500 truncate">
                <span className="text-blue-400">{t.buyDex}</span>
                <span className="text-gray-700 mx-1">→</span>
                <span className="text-purple-400">{t.sellDex}</span>
              </span>
            </div>

            {/* Right: net PnL */}
            <div className="flex items-center gap-2 shrink-0">
              {/* trigger badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                t.triggeredBy === "auto"
                  ? "border-green-800/50 text-green-600 bg-green-900/20"
                  : "border-violet-800/50 text-violet-500 bg-violet-900/20"
              }`}>
                {t.triggeredBy === "auto"
                  ? <><Zap size={9} />auto</>
                  : <><Hand size={9} />manual</>
                }
              </span>
              <span className={`font-mono font-bold text-sm ${t.won ? "text-green-400" : "text-red-400"}`}>
                {t.netPnl >= 0 ? "+" : ""}${t.netPnl?.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Details row */}
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-600">
            <span>spread <span className="text-gray-500">{t.spreadPct?.toFixed(3)}%</span></span>
            <span>size <span className="text-gray-500">${t.tradeSize?.toLocaleString()}</span></span>
            <span>fees <span className="text-gray-500">-${t.fees?.toFixed(2)}</span></span>
            <span className="ml-auto">bal <span className="text-gray-400">${t.balance?.toFixed(2)}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}
