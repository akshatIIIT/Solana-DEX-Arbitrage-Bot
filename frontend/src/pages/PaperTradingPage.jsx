/**
 * pages/PaperTradingPage.jsx
 * The complete Phase 2 paper trading UI tab
 */
import React, { useState } from "react";
import {
  Play, Pause, Zap, Hand, RotateCcw,
  TrendingUp, TrendingDown, DollarSign,
  ShieldAlert, Trophy, Target, Activity
} from "lucide-react";
import { PaperSetupModal } from "../components/PaperSetupModal.jsx";
import { PnlChart } from "../components/PnlChart.jsx";
import { TradeHistory } from "../components/TradeHistory.jsx";

function MiniStat({ label, value, sub, color = "white" }) {
  const colors = {
    green:  "text-green-400",
    red:    "text-red-400",
    amber:  "text-amber-400",
    violet: "text-violet-400",
    white:  "text-white",
  };
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function PaperTradingPage({ paper, enable, disable, setMode, manualExecute, reset, latestOpps }) {
  const [showSetup, setShowSetup] = useState(false);
  const [executing, setExecuting] = useState(null); // token being manually executed
  const [toast, setToast] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleEnable(config) {
    await enable(config);
    setShowSetup(false);
    showToast("Paper trading started!");
  }

  async function handleManualTrade(opp) {
    if (!paper.isEnabled) { showToast("Enable paper trading first", "error"); return; }
    setExecuting(opp.token + opp.buyDex);
    try {
      const result = await manualExecute(opp);
      if (result.ok) {
        showToast(`${opp.token}: ${result.trade.netPnl >= 0 ? "+" : ""}$${result.trade.netPnl.toFixed(2)}`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.error || "Trade failed", "error");
    } finally {
      setExecuting(null);
    }
  }

  const pnlColor = paper.totalPnl >= 0 ? "green" : "red";
  const todayColor = paper.todayPnl >= 0 ? "green" : "red";
  const dailyPct = parseFloat(paper.dailyLimitUsed || 0);

  return (
    <div className="space-y-5">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl border
          ${toast.type === "success"
            ? "bg-green-900/90 border-green-700 text-green-200"
            : "bg-red-900/90 border-red-700 text-red-200"
          }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {!paper.isEnabled ? (
          <button
            onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            <Play size={14} /> Start Paper Trading
          </button>
        ) : (
          <>
            <button
              onClick={disable}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
            >
              <Pause size={14} /> Stop
            </button>

            {/* Auto / Manual toggle */}
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg p-1 gap-1">
              <button
                onClick={() => setMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !paper.autoMode
                    ? "bg-violet-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Hand size={11} /> Manual
              </button>
              <button
                onClick={() => setMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  paper.autoMode
                    ? "bg-green-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Zap size={11} /> Auto
              </button>
            </div>

            <button
              onClick={() => reset(paper.startBalance)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-gray-500 text-xs hover:text-white hover:bg-gray-800 transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>

            {/* Status pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              paper.autoMode
                ? "border-green-700 bg-green-900/30 text-green-400"
                : "border-violet-700 bg-violet-900/30 text-violet-400"
            }`}>
              {paper.autoMode
                ? <><Zap size={10} /> Auto-executing</>
                : <><Hand size={10} /> Manual mode</>
              }
            </div>
          </>
        )}
      </div>

      {/* ── Daily loss limit bar ── */}
      {paper.isEnabled && (
        <div className={`rounded-xl border p-3 ${
          paper.dailyLimitHit
            ? "border-red-700 bg-red-900/20"
            : dailyPct > 50
            ? "border-amber-800/40 bg-amber-900/10"
            : "border-gray-800 bg-gray-900/30"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <ShieldAlert size={12} className={paper.dailyLimitHit ? "text-red-400" : "text-amber-400"} />
              Daily Loss Limit (2%)
            </div>
            <span className={`text-xs font-mono font-bold ${
              paper.dailyLimitHit ? "text-red-400" : dailyPct > 50 ? "text-amber-400" : "text-gray-500"
            }`}>
              {dailyPct}% used
              {paper.dailyLimitHit && " — LIMIT HIT"}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                paper.dailyLimitHit ? "bg-red-500" : dailyPct > 50 ? "bg-amber-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(dailyPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat
          label="Balance"
          value={`$${paper.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`started $${paper.startBalance?.toLocaleString()}`}
          color="white"
        />
        <MiniStat
          label="Total PnL"
          value={`${paper.totalPnl >= 0 ? "+" : ""}$${paper.totalPnl?.toFixed(2)}`}
          sub={`${paper.pnlPct}% return`}
          color={pnlColor}
        />
        <MiniStat
          label="Today's PnL"
          value={`${paper.todayPnl >= 0 ? "+" : ""}$${paper.todayPnl?.toFixed(2)}`}
          sub="resets midnight"
          color={todayColor}
        />
        <MiniStat
          label="Win Rate"
          value={`${paper.winRate}%`}
          sub={`${paper.tradesWon}W / ${paper.tradesLost}L — ${paper.tradesTotal} trades`}
          color={parseFloat(paper.winRate) >= 50 ? "green" : "red"}
        />
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* PnL Chart + Trade History */}
        <div className="lg:col-span-3 space-y-4">

          {/* PnL Chart */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Activity size={14} className="text-violet-400" />
                Balance Over Time
              </h3>
              {paper.recentTrades?.length > 0 && (
                <span className="text-xs text-gray-600">{paper.recentTrades.length} trades</span>
              )}
            </div>
            <PnlChart
              trades={paper.recentTrades}
              startBalance={paper.startBalance || 10000}
            />
          </div>

          {/* Trade history */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              Trade History
            </h3>
            <TradeHistory trades={paper.recentTrades} />
          </div>
        </div>

        {/* Manual execution panel */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Target size={14} className="text-blue-400" />
              Live Opportunities
            </h3>
            {paper.isEnabled && !paper.autoMode && (
              <span className="text-xs text-violet-400 bg-violet-900/30 border border-violet-800/40 px-2 py-0.5 rounded-full">
                Click to trade
              </span>
            )}
            {paper.isEnabled && paper.autoMode && (
              <span className="text-xs text-green-400 bg-green-900/30 border border-green-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={9} /> Auto
              </span>
            )}
          </div>

          {!latestOpps?.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm gap-2">
              <Activity size={24} strokeWidth={1} />
              Scanning...
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[480px] scrollbar-thin pr-1">
              {latestOpps.map((opp, i) => {
                const execKey = opp.token + opp.buyDex;
                const isExec  = executing === execKey;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 transition-all ${
                      opp.isViable
                        ? "border-green-700/40 bg-green-900/10"
                        : "border-gray-800 bg-gray-900/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          opp.isViable ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"
                        }`}>
                          {opp.token}
                        </span>
                        <span className="text-xs text-gray-500">
                          <span className="text-blue-400">{opp.buyDex}</span>
                          <span className="mx-1 text-gray-700">→</span>
                          <span className="text-purple-400">{opp.sellDex}</span>
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-bold ${
                        opp.spreadPct >= 0.5 ? "text-green-400"
                        : opp.spreadPct >= 0.3 ? "text-amber-400"
                        : "text-gray-600"
                      }`}>
                        {opp.spreadPct.toFixed(3)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${opp.netProfitUsd > 0 ? "text-green-400" : "text-red-400"}`}>
                        net {opp.netProfitUsd > 0 ? "+" : ""}${opp.netProfitUsd?.toFixed(2)}
                      </span>

                      {/* Manual execute button */}
                      {paper.isEnabled && !paper.autoMode && opp.isViable && (
                        <button
                          onClick={() => handleManualTrade(opp)}
                          disabled={isExec || paper.dailyLimitHit}
                          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                            isExec
                              ? "bg-gray-700 text-gray-500 cursor-wait"
                              : paper.dailyLimitHit
                              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                              : "bg-violet-600 hover:bg-violet-500 text-white"
                          }`}
                        >
                          {isExec ? (
                            <><span className="animate-spin inline-block">⟳</span> Trading...</>
                          ) : (
                            <><Hand size={10} /> Execute</>
                          )}
                        </button>
                      )}

                      {paper.isEnabled && paper.autoMode && opp.isViable && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <Zap size={9} /> auto
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Setup modal ── */}
      {showSetup && (
        <PaperSetupModal
          onConfirm={handleEnable}
          onClose={() => setShowSetup(false)}
          current={paper}
        />
      )}
    </div>
  );
}
