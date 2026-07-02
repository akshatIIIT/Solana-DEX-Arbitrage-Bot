/**
 * App.jsx — Phase 3 complete
 * Adds Real Trading tab alongside Scanner, Paper Trading, Charts, History
 */
import React, { useState } from "react";
import {
  Activity, Zap, TrendingUp, Eye, Wifi, WifiOff,
  BarChart2, RefreshCw, Database, FlaskConical, Flame
} from "lucide-react";
import { useScanner }  from "./hooks/useScanner.js";
import { usePaper }    from "./hooks/usePaper.js";
import { useReal }     from "./hooks/useReal.js";
import { StatCard }    from "./components/StatCard.jsx";
import { PriceTable }  from "./components/PriceTable.jsx";
import { OpportunityFeed } from "./components/OpportunityFeed.jsx";
import { PriceChart }  from "./components/PriceChart.jsx";
import { SpreadChart } from "./components/SpreadChart.jsx";
import { PaperTradingPage } from "./pages/PaperTradingPage.jsx";
import { RealTradingPage }  from "./pages/RealTradingPage.jsx";

const TOKENS = ["SOL", "BONK", "JUP", "WIF", "PYTH"];
const TOKEN_COLORS = {
  SOL: "#9333ea", BONK: "#f59e0b", JUP: "#3b82f6", WIF: "#10b981", PYTH: "#f43f5e",
};

export default function App() {
  const { prices, opportunities, stats, connected, history, socket } = useScanner();
  const { paper, enable: enablePaper, disable: disablePaper, setMode, manualExecute, reset } = usePaper(socket);
  const { real, enable: enableReal, disable: disableReal, emergencyStop, clearEmergency, testTelegram, manualTrade } = useReal(socket);

  const [selectedTokens, setSelectedTokens] = useState(["SOL"]);
  const [activeTab, setActiveTab] = useState("scanner");

  const viableOpps = opportunities.filter(o => o.isViable);

  function toggleToken(t) {
    setSelectedTokens(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }

  // Determine phase label
  let phaseLabel = "Phase 1 — Scanner";
  if (real.isEnabled)        phaseLabel = "Phase 3 — Live Trading";
  else if (paper.isEnabled)  phaseLabel = "Phase 2 — Paper Trading";

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ── */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${
              real.isEnabled
                ? "bg-green-600/20 border-green-700/30"
                : "bg-violet-600/20 border-violet-700/30"
            }`}>
              <Zap size={18} className={real.isEnabled ? "text-green-400" : "text-violet-400"} />
            </div>
            <div>
              <h1 className="font-bold text-white leading-none">Solana Arb Bot</h1>
              <p className="text-xs text-gray-500 mt-0.5">{phaseLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Scan timer */}
            {stats.lastScanAt && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
                <RefreshCw size={11} className="animate-spin" style={{ animationDuration: "2s" }} />
                {new Date(stats.lastScanAt).toLocaleTimeString()}
              </div>
            )}

            {/* Real trading balance */}
            {real.isEnabled && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-green-800 bg-green-900/20 text-green-400">
                ⚡ ${real.usdBalance?.toFixed(2)}
              </div>
            )}

            {/* Paper balance */}
            {paper.isEnabled && !real.isEnabled && (
              <div className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
                paper.totalPnl >= 0
                  ? "text-green-400 border-green-800 bg-green-900/20"
                  : "text-red-400 border-red-800 bg-red-900/20"
              }`}>
                📄 ${paper.balance?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            )}

            {/* Emergency stop indicator */}
            {real.emergencyStop && (
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-red-700 bg-red-900/30 text-red-400 animate-pulse">
                🛑 STOPPED
              </div>
            )}

            {/* Connection status */}
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
              connected
                ? "text-green-400 border-green-800 bg-green-900/20"
                : "text-red-400 border-red-800 bg-red-900/20"
            }`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? "Live" : "Offline"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto">
          {[
            { id: "scanner", label: "Scanner",       icon: Activity },
            { id: "paper",   label: "Paper Trading", icon: FlaskConical,
              badge: paper.isEnabled ? (paper.autoMode ? "AUTO" : "ON") : null,
              badgeColor: "violet" },
            { id: "real",    label: "Real Trading",  icon: Flame,
              badge: real.isEnabled ? "LIVE" : real.emergencyStop ? "STOP" : null,
              badgeColor: real.emergencyStop ? "red" : "green" },
            { id: "charts",  label: "Charts",        icon: BarChart2 },
            { id: "history", label: "History",       icon: Database },
          ].map(({ id, label, icon: Icon, badge, badgeColor }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "bg-violet-600/20 text-violet-400 border border-violet-700/40"
                  : "text-gray-500 hover:text-gray-300"
              }`}>
              <Icon size={13} />
              {label}
              {badge && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  badgeColor === "red"    ? "bg-red-700 text-white" :
                  badgeColor === "green"  ? "bg-green-700 text-white" :
                  "bg-violet-700 text-white"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">

        {/* ── SCANNER TAB ── */}
        {activeTab === "scanner" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Scans" value={stats.scansTotal.toLocaleString()} sub="every 5s" icon={Activity} color="violet" pulse={connected} />
              <StatCard label="Viable Opportunities" value={viableOpps.length} sub={`of ${opportunities.length} detected`} icon={TrendingUp} color={viableOpps.length > 0 ? "green" : "blue"} />
              <StatCard label="Best Spread Ever" value={`${(stats.bestSpreadEver || 0).toFixed(3)}%`} sub="this session" icon={Eye} color="amber" />
              <StatCard label="Opps Found" value={stats.oppsFound?.toLocaleString() || "0"} sub={`${stats.scanMs || 0}ms last scan`} icon={Zap} color="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-blue-400">◎</span> Live Prices
                  </h2>
                  <span className="text-xs text-gray-600">Jupiter · Raydium · Orca</span>
                </div>
                <PriceTable prices={prices} />
              </div>

              <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <TrendingUp size={15} className="text-green-400" /> Opportunities
                  </h2>
                  {viableOpps.length > 0 && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">
                      {viableOpps.length} viable
                    </span>
                  )}
                </div>
                <OpportunityFeed opportunities={opportunities} />
              </div>
            </div>
          </>
        )}

        {/* ── PAPER TRADING TAB ── */}
        {activeTab === "paper" && (
          <PaperTradingPage
            paper={paper}
            enable={enablePaper}
            disable={disablePaper}
            setMode={setMode}
            manualExecute={manualExecute}
            reset={reset}
            latestOpps={opportunities}
          />
        )}

        {/* ── REAL TRADING TAB ── */}
        {activeTab === "real" && (
          <RealTradingPage
            real={real}
            enable={enableReal}
            disable={disableReal}
            emergencyStop={emergencyStop}
            clearEmergency={clearEmergency}
            testTelegram={testTelegram}
            manualTrade={manualTrade}
            latestOpps={opportunities}
          />
        )}

        {/* ── CHARTS TAB ── */}
        {activeTab === "charts" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {TOKENS.map(t => (
                <button key={t} onClick={() => toggleToken(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    selectedTokens.includes(t)
                      ? "border-current bg-current/10"
                      : "border-gray-800 text-gray-600 hover:text-gray-400"
                  }`}
                  style={selectedTokens.includes(t) ? { color: TOKEN_COLORS[t], borderColor: TOKEN_COLORS[t] + "60" } : {}}>
                  {t}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <h2 className="font-semibold text-white mb-4">Price History (live)</h2>
              <PriceChart history={history} selectedTokens={selectedTokens} />
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Spread by Token</h2>
                <span className="text-xs text-gray-600">dashed = 0.3% threshold</span>
              </div>
              <SpreadChart opportunities={opportunities} />
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Database size={15} className="text-violet-400" /> Session Opportunity Log
            </h2>
            {opportunities.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-12">No opportunities this session</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500">
                      <th className="text-left py-2 px-2">Token</th>
                      <th className="text-left py-2 px-2">Route</th>
                      <th className="text-right py-2 px-2">Spread</th>
                      <th className="text-right py-2 px-2">Buy</th>
                      <th className="text-right py-2 px-2">Sell</th>
                      <th className="text-right py-2 px-2">Net ($1k)</th>
                      <th className="text-center py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-white/2">
                        <td className="py-2 px-2 font-bold text-white">{opp.token}</td>
                        <td className="py-2 px-2 text-gray-400">
                          <span className="text-blue-400">{opp.buyDex}</span>
                          <span className="text-gray-700 mx-1">→</span>
                          <span className="text-purple-400">{opp.sellDex}</span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-400">{opp.spreadPct.toFixed(4)}%</td>
                        <td className="py-2 px-2 text-right font-mono text-blue-400">${opp.buyPrice?.toFixed(4)}</td>
                        <td className="py-2 px-2 text-right font-mono text-purple-400">${opp.sellPrice?.toFixed(4)}</td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${opp.netProfitUsd > 0 ? "text-green-400" : "text-red-400"}`}>
                          {opp.netProfitUsd > 0 ? "+" : ""}{opp.netProfitUsd?.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${opp.isViable ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-600"}`}>
                            {opp.isViable ? "VIABLE" : "below min"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Fee model footer ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Fee Model (per $1,000 trade)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            {[
              { label: "Trading Fee (×2)", value: "0.50%",  sub: "0.25% each side",  color: "text-blue-400" },
              { label: "Slippage Est.",    value: "0.20%",  sub: "market impact",     color: "text-amber-400" },
              { label: "Network Fee",      value: "~$0.004",sub: "2 transactions",    color: "text-purple-400" },
              { label: "Min Viable Spread",value: "≥0.30%", sub: "to be profitable",  color: "text-green-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-gray-800/40 rounded-lg p-3">
                <p className="text-gray-600">{label}</p>
                <p className={`font-bold font-mono mt-1 ${color}`}>{value}</p>
                <p className="text-gray-700 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
