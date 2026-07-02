/**
 * components/PaperSetupModal.jsx
 * Modal to configure paper trading (balance, trade size, auto/manual)
 */
import React, { useState } from "react";
import { X, DollarSign, Zap, Hand, AlertTriangle } from "lucide-react";

export function PaperSetupModal({ onConfirm, onClose, current }) {
  const [balance,   setBalance]   = useState(current?.startBalance || 10000);
  const [tradeSize, setTradeSize] = useState(current?.tradeSize    || 1000);
  const [autoMode,  setAutoMode]  = useState(current?.autoMode     ?? false);
  const [error,     setError]     = useState("");

  function validate() {
    if (!balance || balance < 100)     return "Minimum starting balance is $100";
    if (!tradeSize || tradeSize < 10)  return "Minimum trade size is $10";
    if (tradeSize > balance * 0.5)     return "Trade size cannot exceed 50% of balance (risk control)";
    return "";
  }

  function handleConfirm() {
    const err = validate();
    if (err) { setError(err); return; }
    onConfirm({ balance: parseFloat(balance), tradeSize: parseFloat(tradeSize), autoMode });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Setup Paper Trading</h2>
            <p className="text-xs text-gray-500 mt-0.5">No real money — simulated trades only</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Balance input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Starting Balance (USD)
          </label>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2.5
                         text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="10000"
              min="100"
              max="1000000"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[1000, 5000, 10000, 50000].map(v => (
              <button key={v} onClick={() => setBalance(v)}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Trade size input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trade Size per Opportunity (USD)
          </label>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="number"
              value={tradeSize}
              onChange={e => setTradeSize(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2.5
                         text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="1000"
              min="10"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {balance && tradeSize ? `${((tradeSize/balance)*100).toFixed(1)}% of balance per trade` : ""}
          </p>
        </div>

        {/* Auto / Manual mode */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">Execution Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAutoMode(false)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                !autoMode
                  ? "border-violet-600 bg-violet-600/20 text-violet-300"
                  : "border-gray-700 text-gray-500 hover:text-gray-300"
              }`}
            >
              <Hand size={14} />
              Manual
              <span className="text-xs opacity-60 ml-auto">you click</span>
            </button>
            <button
              onClick={() => setAutoMode(true)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                autoMode
                  ? "border-green-600 bg-green-600/20 text-green-300"
                  : "border-gray-700 text-gray-500 hover:text-gray-300"
              }`}
            >
              <Zap size={14} />
              Auto
              <span className="text-xs opacity-60 ml-auto">instant</span>
            </button>
          </div>
        </div>

        {/* Risk info */}
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 mb-5">
          <div className="flex gap-2">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80">
              Daily loss limit: <strong>2%</strong> of starting balance (${((balance||0)*0.02).toFixed(2)}).
              Bot stops automatically when hit.
              Trade size capped at 50% of balance.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs mb-3 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:text-white hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
            Start Paper Trading
          </button>
        </div>
      </div>
    </div>
  );
}
