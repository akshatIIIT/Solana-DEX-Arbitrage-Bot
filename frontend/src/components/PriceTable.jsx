import React from "react";

const DEX_COLORS = {
  jupiter: "text-green-400",
  raydium: "text-blue-400",
  orca:    "text-purple-400",
};

const TOKEN_EMOJI = {
  SOL: "◎", BONK: "🐶", JUP: "🪐", WIF: "🐕", PYTH: "🔮",
};

export function PriceTable({ prices }) {
  const tokens = Object.keys(prices);

  if (!tokens.length) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
        Waiting for price data...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Token</th>
            <th className="text-right py-2 px-3 text-green-500 font-medium">Jupiter</th>
            <th className="text-right py-2 px-3 text-blue-500 font-medium">Raydium</th>
            <th className="text-right py-2 px-3 text-purple-500 font-medium">Orca</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Max Spread</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map(token => {
            const sources = prices[token];
            const vals = Object.values(sources).filter(Boolean);
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            const spread = vals.length > 1 ? ((max - min) / min) * 100 : 0;

            return (
              <tr key={token} className="border-b border-gray-800/50 hover:bg-white/2 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TOKEN_EMOJI[token] || "●"}</span>
                    <div>
                      <span className="font-semibold text-white">{token}</span>
                      <span className="text-gray-600 text-xs block">/ USDC</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono text-green-400">
                  {sources.jupiter ? `$${sources.jupiter.toFixed(4)}` : <span className="text-gray-700">—</span>}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-400">
                  {sources.raydium ? `$${sources.raydium.toFixed(4)}` : <span className="text-gray-700">—</span>}
                </td>
                <td className="py-3 px-3 text-right font-mono text-purple-400">
                  {sources.orca ? `$${sources.orca.toFixed(4)}` : <span className="text-gray-700">—</span>}
                </td>
                <td className="py-3 px-3 text-right">
                  <span className={`font-mono font-bold ${
                    spread >= 0.5 ? "text-green-400" :
                    spread >= 0.2 ? "text-amber-400" :
                    "text-gray-600"
                  }`}>
                    {spread > 0 ? `${spread.toFixed(3)}%` : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
