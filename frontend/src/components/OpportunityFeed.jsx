import React from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

function SpreadBadge({ pct }) {
  const color = pct >= 0.5 ? "bg-green-500/20 text-green-400 border-green-700/40"
    : pct >= 0.2 ? "bg-amber-500/20 text-amber-400 border-amber-700/40"
    : "bg-gray-800 text-gray-500 border-gray-700";
  return (
    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {pct.toFixed(3)}%
    </span>
  );
}

export function OpportunityFeed({ opportunities }) {
  if (!opportunities?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-600">
        <AlertCircle size={32} strokeWidth={1} />
        <p className="text-sm">Scanning for opportunities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-96 scrollbar-thin pr-1">
      {opportunities.map((opp, i) => (
        <div
          key={i}
          className={`rounded-lg border p-3 transition-all ${
            opp.isViable
              ? "border-green-700/40 bg-green-900/10"
              : "border-gray-800 bg-gray-900/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Token + route */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded
                ${opp.isViable ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                {opp.token}
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0 truncate">
                <span className="text-blue-400 capitalize">{opp.buyDex}</span>
                <span className="text-gray-700">→</span>
                <span className="text-purple-400 capitalize">{opp.sellDex}</span>
              </div>
            </div>
            <SpreadBadge pct={opp.spreadPct} />
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-gray-600">Buy</p>
              <p className="text-blue-400 font-mono">${opp.buyPrice?.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-600">Sell</p>
              <p className="text-purple-400 font-mono">${opp.sellPrice?.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-600">Gross</p>
              <p className="text-green-400 font-mono">+${opp.grossProfitUsd?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Net ($1k)</p>
              <p className={`font-mono font-bold ${opp.netProfitUsd > 0 ? "text-green-400" : "text-red-400"}`}>
                {opp.netProfitUsd > 0 ? "+" : ""}{opp.netProfitUsd?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
