import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

export function SpreadChart({ opportunities }) {
  const data = useMemo(() => {
    const byToken = {};
    for (const opp of opportunities) {
      if (!byToken[opp.token] || opp.spreadPct > byToken[opp.token].spread) {
        byToken[opp.token] = { token: opp.token, spread: opp.spreadPct };
      }
    }
    return Object.values(byToken).sort((a, b) => b.spread - a.spread);
  }, [opportunities]);

  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-600 text-sm">
        No spread data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="token" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false}
          tickFormatter={v => `${v.toFixed(2)}%`} width={50} />
        <Tooltip
          formatter={(v) => [`${v.toFixed(4)}%`, "Spread"]}
          contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
        />
        <ReferenceLine y={0.3} stroke="#6b7280" strokeDasharray="3 3" />
        <Bar dataKey="spread" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.spread >= 0.5 ? "#16a34a" : entry.spread >= 0.2 ? "#d97706" : "#4b5563"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
