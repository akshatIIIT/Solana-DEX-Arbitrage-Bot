/**
 * components/PnlChart.jsx
 * Running balance + PnL over time
 */
import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400">{d.label}</p>
      <p className="font-bold text-white mt-1">Balance: ${Number(d.balance).toFixed(2)}</p>
      <p className={`font-mono mt-0.5 ${d.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
        PnL: {d.pnl >= 0 ? "+" : ""}${Number(d.pnl).toFixed(2)}
      </p>
    </div>
  );
};

export function PnlChart({ trades, startBalance }) {
  const data = useMemo(() => {
    if (!trades?.length) return [];
    let running = startBalance;
    return trades
      .slice()
      .reverse()
      .map((t, i) => {
        running = t.balance ?? running + t.netPnl;
        return {
          i: i + 1,
          label: `Trade #${i + 1} — ${t.token}`,
          balance: parseFloat(running.toFixed(2)),
          pnl: parseFloat((running - startBalance).toFixed(2)),
        };
      });
  }, [trades, startBalance]);

  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
        No trades yet — execute a trade to see PnL chart
      </div>
    );
  }

  const min = Math.min(...data.map(d => d.balance));
  const max = Math.max(...data.map(d => d.balance));
  const isProfit = data[data.length - 1]?.pnl >= 0;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={isProfit ? "#16a34a" : "#dc2626"} stopOpacity={0.3} />
            <stop offset="95%" stopColor={isProfit ? "#16a34a" : "#dc2626"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false} axisLine={false}
          width={65}
          domain={[min * 0.999, max * 1.001]}
          tickFormatter={v => `$${v.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={startBalance} stroke="#374151" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={isProfit ? "#16a34a" : "#dc2626"}
          strokeWidth={2}
          fill="url(#pnlGrad)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
