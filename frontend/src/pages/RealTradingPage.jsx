/**
 * pages/RealTradingPage.jsx
 * Phase 3 — Real trading dashboard
 */
import React, { useState } from "react";
import {
  AlertTriangle, ShieldOff, ShieldCheck, Zap, Send,
  ExternalLink, Power, PowerOff, Activity, Trophy,
  DollarSign, TrendingUp, TrendingDown, Bell
} from "lucide-react";
import { PnlChart } from "../components/PnlChart.jsx";

function RealStatCard({ label, value, sub, color = "white", icon: Icon }) {
  const colors = {
    green:  "text-green-400", red:  "text-red-400",
    amber:  "text-amber-400", violet: "text-violet-400", white: "text-white",
  };
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={13} className="text-gray-500" />}
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function TxLink({ sig, label }) {
  if (!sig) return <span className="text-gray-600">—</span>;
  return (
    <a
      href={`https://solscan.io/tx/${sig}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-mono transition-colors"
    >
      {sig.slice(0, 12)}...{sig.slice(-6)}
      <ExternalLink size={10} />
    </a>
  );
}

export function RealTradingPage({ real, enable, disable, emergencyStop, clearEmergency, testTelegram, manualTrade, latestOpps }) {
  const [confirming, setConfirming]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [telegramTesting, setTgTesting] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleEnable() {
    try {
      await enable();
      setConfirming(false);
      showToast("⚡ Real trading enabled!", "success");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to enable", "error");
      setConfirming(false);
    }
  }

  async function handleEmergencyStop() {
    await emergencyStop("Manual emergency stop from dashboard");
    showToast("🛑 Emergency stop triggered", "error");
  }

  async function handleTestTelegram() {
    setTgTesting(true);
    try {
      await testTelegram();
      showToast("✅ Telegram test message sent!", "success");
    } catch (err) {
      showToast(err?.response?.data?.error || "Telegram not configured", "error");
    } finally {
      setTgTesting(false);
    }
  }

  const pnlColor   = real.totalPnlUsd >= 0 ? "green" : "red";
  const todayColor = real.todayPnlUsd >= 0 ? "green" : "red";
  const dailyPct   = parseFloat(real.dailyLimitUsed || 0);

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl border ${
          toast.type === "success"
            ? "bg-green-900/90 border-green-700 text-green-200"
            : "bg-red-900/90 border-red-700 text-red-200"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Emergency Stop Banner ── */}
      {real.emergencyStop && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldOff size={20} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-300">🛑 EMERGENCY STOP ACTIVE</p>
                <p className="text-sm text-red-400/80 mt-1">{real.emergencyReason}</p>
                <p className="text-xs text-red-600 mt-1">All trading halted. Inspect logs before resuming.</p>
              </div>
            </div>
            <button
              onClick={clearEmergency}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors shrink-0"
            >
              Clear & Resume
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm Enable Modal ── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-amber-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-amber-400" />
              <h2 className="text-lg font-bold text-white">Enable Real Trading?</h2>
            </div>

            <div className="space-y-3 mb-6 text-sm text-gray-300">
              <p>This will execute trades with <strong className="text-white">real SOL</strong> on mainnet.</p>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-xs">
                <p>💼 Wallet: <span className="font-mono text-violet-400">{real.walletAddress?.slice(0,16)}...</span></p>
                <p>💰 Balance: <span className="text-white font-bold">{real.solBalance?.toFixed(4)} SOL (~${real.usdBalance?.toFixed(2)})</span></p>
                <p>🎯 Max per trade: <span className="text-white">${real.maxTradeUsd}</span></p>
                <p>🛡️ Daily loss limit: <span className="text-white">{real.maxDailyLossPct}%</span></p>
                <p>⚡ Min profit to trade: <span className="text-white">${real.minProfitUsd}</span></p>
              </div>
              <p className="text-amber-400 text-xs">
                ⚠️ Only trade what you can afford to lose. Crypto markets are volatile.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleEnable}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors text-sm">
                ✅ Yes, Enable Real Trading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {!real.isEnabled ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={real.emergencyStop}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              real.emergencyStop
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            <Power size={14} /> Enable Real Trading
          </button>
        ) : (
          <button onClick={disable}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
            <PowerOff size={14} /> Disable
          </button>
        )}

        {/* Emergency Stop */}
        <button
          onClick={handleEmergencyStop}
          disabled={real.emergencyStop}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
            real.emergencyStop
              ? "border-gray-700 text-gray-600 cursor-not-allowed"
              : "border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/60"
          }`}
        >
          <ShieldOff size={14} /> Emergency Stop
        </button>

        {/* Test Telegram */}
        <button
          onClick={handleTestTelegram}
          disabled={telegramTesting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-gray-500 text-xs hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Bell size={12} />
          {telegramTesting ? "Sending..." : "Test Telegram"}
        </button>

        {/* Status pill */}
        {real.isEnabled && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-green-700 bg-green-900/30 text-green-400">
            <Zap size={10} /> Live Trading Active
          </div>
        )}
      </div>

      {/* ── Wallet card ── */}
      {real.walletAddress && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Wallet</p>
            <a
              href={`https://solscan.io/account/${real.walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
            >
              {real.walletAddress.slice(0, 20)}...{real.walletAddress.slice(-8)}
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-500">SOL Balance</p>
              <p className="font-bold text-white">{real.solBalance?.toFixed(6)} SOL</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">USD Value</p>
              <p className="font-bold text-white">${real.usdBalance?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SOL Price</p>
              <p className="font-bold text-gray-300">${real.solPrice?.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* No wallet yet */}
      {!real.walletAddress && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Wallet not configured</p>
              <p className="text-sm text-amber-400/70 mt-1">Run this in your backend terminal:</p>
              <code className="block mt-2 bg-gray-900 text-green-400 rounded px-3 py-2 text-sm font-mono">
                node src/utils/walletSetup.js
              </code>
              <p className="text-xs text-amber-600 mt-2">Then add your Telegram bot token and chat ID to .env</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily loss limit ── */}
      {real.isEnabled && (
        <div className={`rounded-xl border p-3 ${
          real.dailyLimitHit ? "border-red-700 bg-red-900/20"
          : dailyPct > 50 ? "border-amber-800/40 bg-amber-900/10"
          : "border-gray-800 bg-gray-900/30"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <ShieldCheck size={12} className={real.dailyLimitHit ? "text-red-400" : "text-green-400"} />
              Daily Loss Limit ({real.maxDailyLossPct}%) — resets midnight
            </div>
            <span className={`text-xs font-mono font-bold ${
              real.dailyLimitHit ? "text-red-400" : dailyPct > 50 ? "text-amber-400" : "text-gray-500"
            }`}>
              {dailyPct}% used {real.dailyLimitHit && "— TRADING PAUSED"}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${
              real.dailyLimitHit ? "bg-red-500" : dailyPct > 50 ? "bg-amber-500" : "bg-green-500"
            }`} style={{ width: `${Math.min(dailyPct, 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RealStatCard label="USD Balance" value={`$${real.usdBalance?.toFixed(2)}`} sub={`${real.solBalance?.toFixed(4)} SOL`} color="white" icon={DollarSign} />
        <RealStatCard label="Total P&L" value={`${real.totalPnlUsd >= 0 ? "+" : ""}$${real.totalPnlUsd?.toFixed(2)}`} sub="all time" color={pnlColor} icon={TrendingUp} />
        <RealStatCard label="Today's P&L" value={`${real.todayPnlUsd >= 0 ? "+" : ""}$${real.todayPnlUsd?.toFixed(2)}`} sub="resets midnight" color={todayColor} icon={Activity} />
        <RealStatCard label="Win Rate" value={`${real.winRate}%`} sub={`${real.tradesWon}W / ${real.tradesLost}L — ${real.tradesTotal} trades`} color={parseFloat(real.winRate) >= 50 ? "green" : "red"} icon={Trophy} />
      </div>

      {/* ── Main grid: Chart + Live opps ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* PnL Chart + Trade History */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Activity size={14} className="text-green-400" />
              Real P&L Over Time
            </h3>
            <PnlChart
              trades={real.recentTrades}
              startBalance={real.usdBalance - real.totalPnlUsd}
            />
          </div>

          {/* Real trade history */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              Real Trade History
            </h3>
            {!real.recentTrades?.length ? (
              <div className="flex flex-col items-center justify-center h-24 text-gray-600 text-sm gap-2">
                <Zap size={20} strokeWidth={1} />
                No real trades yet
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-72 scrollbar-thin pr-1">
                {real.recentTrades.map((t, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 ${
                    t.won ? "border-green-800/40 bg-green-900/10" : "border-red-800/40 bg-red-900/10"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {t.won ? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />}
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.won ? "bg-green-700/40 text-green-300" : "bg-red-700/40 text-red-300"}`}>
                          {t.token}
                        </span>
                        <span className="text-xs text-gray-500">
                          <span className="text-blue-400">{t.buyDex}</span>
                          <span className="text-gray-700 mx-1">→</span>
                          <span className="text-purple-400">{t.sellDex}</span>
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-sm ${t.won ? "text-green-400" : "text-red-400"}`}>
                        {t.netPnlUsd >= 0 ? "+" : ""}${t.netPnlUsd?.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-600">
                      <span>spread <span className="text-gray-500">{t.spreadPct?.toFixed(3)}%</span></span>
                      <span>size <span className="text-gray-500">${t.tradeSizeUsd?.toFixed(0)}</span></span>
                      <TxLink sig={t.txSignature} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live opportunities */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Live Opportunities
            </h3>
            {real.isEnabled && (
              <span className="text-xs text-green-400 bg-green-900/30 border border-green-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={9} /> Auto-trading
              </span>
            )}
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px] scrollbar-thin pr-1">
            {!latestOpps?.length ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm gap-2">
                <Activity size={24} strokeWidth={1} />
                Scanning...
              </div>
            ) : latestOpps.map((opp, i) => (
              <div key={i} className={`rounded-lg border p-3 ${
                opp.isViable ? "border-green-700/40 bg-green-900/10" : "border-gray-800 bg-gray-900/30 opacity-50"
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${opp.isViable ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                      {opp.token}
                    </span>
                    <span className="text-xs text-gray-500">
                      <span className="text-blue-400">{opp.buyDex}</span>
                      <span className="mx-1 text-gray-700">→</span>
                      <span className="text-purple-400">{opp.sellDex}</span>
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${
                    opp.spreadPct >= 0.5 ? "text-green-400" : opp.spreadPct >= 0.3 ? "text-amber-400" : "text-gray-600"
                  }`}>
                    {opp.spreadPct.toFixed(3)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-mono ${opp.netProfitUsd > 0 ? "text-green-400" : "text-red-400"}`}>
                    net {opp.netProfitUsd > 0 ? "+" : ""}${opp.netProfitUsd?.toFixed(2)}
                  </span>
                  {real.isEnabled && opp.isViable && (
                    <span className="text-green-500 flex items-center gap-1 text-xs">
                      <Zap size={9} /> executing
                    </span>
                  )}
                  {!real.isEnabled && opp.isViable && (
                    <button
                      onClick={() => manualTrade(opp)}
                      className="text-xs px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
                    >
                      Manual
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Setup checklist (shown when not configured) ── */}
      {!real.isEnabled && !real.walletAddress && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck size={15} className="text-violet-400" /> Phase 3 Setup Checklist
          </h3>
          <div className="space-y-3 text-sm">
            {[
              { step: "1", label: "Generate wallet", cmd: "node src/utils/walletSetup.js", desc: "Creates your mainnet trading wallet" },
              { step: "2", label: "Fund wallet with $50 of SOL", cmd: null, desc: "Send SOL to the address shown after step 1" },
              { step: "3", label: "Add Telegram bot token", cmd: null, desc: "Message @BotFather → /newbot → copy token to .env" },
              { step: "4", label: "Get Telegram chat ID", cmd: null, desc: "Message your bot, visit /getUpdates, copy chat.id to .env" },
              { step: "5", label: "Test Telegram", cmd: null, desc: 'Click "Test Telegram" button above' },
              { step: "6", label: "Enable real trading", cmd: null, desc: "Click Enable button when ready" },
            ].map(({ step, label, cmd, desc }) => (
              <div key={step} className="flex gap-3 items-start">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="text-white font-medium">{label}</p>
                  {cmd && (
                    <code className="block mt-1 text-xs bg-gray-800 text-green-400 rounded px-2 py-1 font-mono">{cmd}</code>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
