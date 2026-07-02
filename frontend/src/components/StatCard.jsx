import React from "react";
import clsx from "clsx";

export function StatCard({ label, value, sub, icon: Icon, color = "violet", pulse }) {
  const colors = {
    violet: "from-violet-600/20 to-violet-900/10 border-violet-700/30 text-violet-400",
    green:  "from-green-600/20  to-green-900/10  border-green-700/30  text-green-400",
    blue:   "from-blue-600/20   to-blue-900/10   border-blue-700/30   text-blue-400",
    amber:  "from-amber-600/20  to-amber-900/10  border-amber-700/30  text-amber-400",
    rose:   "from-rose-600/20   to-rose-900/10   border-rose-700/30   text-rose-400",
  };

  return (
    <div className={clsx(
      "relative rounded-xl border bg-gradient-to-br p-4 overflow-hidden",
      colors[color]
    )}>
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 p-2 rounded-lg bg-white/5">
            <Icon size={16} className="text-current" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
