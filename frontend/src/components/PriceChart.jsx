import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

const TOKEN_COLORS = {
  SOL: "#9333ea", BONK: "#f59e0b", JUP: "#3b82f6",
  WIF: "#10b981", PYTH: "#f43f5e",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <span style={{ color: p.color }}>●</span>
          <span className="text-gray-400">{p.dataKey}:</span>
          <span className="font-mono font-bold text-white">${Number(p.value).toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
};

export function PriceChart({ history, selectedTokens = ["SOL"] }) {
  const data = useMemo(() => history.map(h => ({
    ...h,
    time: new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  })), [history]);

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
        Collecting price data...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={v => `$${v.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        {selectedTokens.map(token => (
          <Line
            key={token}
            type="monotone"
            dataKey={token}
            stroke={TOKEN_COLORS[token] || "#6b7280"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
