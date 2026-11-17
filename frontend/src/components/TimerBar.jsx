import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function TimerBar({ startedAt, durationSeconds = 7.0, onTimeout, compact = false }) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const elapsed = now - startedAt;
      const remaining = Math.max(0, durationSeconds - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (onTimeout) onTimeout();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 50);
    return () => clearInterval(interval);
  }, [startedAt, durationSeconds, onTimeout]);

  const percentage = Math.min(100, Math.max(0, (timeLeft / durationSeconds) * 100));

  let colorClass = 'bg-cyan-500 shadow-cyan-500/50';
  let textClass = 'text-cyan-400';
  let isDanger = false;

  // Warning thresholds scale with the window (35% / 15% left), min 2.5s / 4.5s.
  const dangerAt = Math.max(2.5, durationSeconds * 0.15);
  const warnAt = Math.max(4.5, durationSeconds * 0.35);
  if (timeLeft < dangerAt) {
    colorClass = 'bg-red-500 shadow-red-500/60 animate-pulse';
    textClass = 'text-red-400 font-bold animate-pulse';
    isDanger = true;
  } else if (timeLeft < warnAt) {
    colorClass = 'bg-amber-400 shadow-amber-400/50';
    textClass = 'text-amber-400';
  }

  if (compact) {
    return (
      <div className="w-full">
        <div className={`flex items-center justify-between font-mono text-[13px] mb-1 ${textClass}`}>
          <span className="flex items-center gap-1">
            {isDanger ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {isDanger ? 'GAMBIT SOON' : 'DECISION'}
          </span>
          <span className="font-orbitron font-bold text-base">{timeLeft.toFixed(0)}s</span>
        </div>
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
          <div className={`h-full rounded-full transition-all duration-75 ${colorClass}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#070d1e] border border-cyan-500/30 rounded-lg p-2.5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
        <div className="flex items-center gap-1.5">
          {isDanger ? (
            <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
          ) : (
            <Clock className="w-4 h-4 text-cyan-400" />
          )}
          <span className="uppercase tracking-wider">
            {isDanger ? 'URGENT: TIME LIMIT EXPIRING' : 'TACTICAL DECISION WINDOW'}
          </span>
        </div>
        <div className={textClass}>
          {timeLeft.toFixed(1)}s REMAINING {isDanger && '— [AUTO-AI GAMBIT ACTIVATING]'}
        </div>
      </div>

      <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-75 shadow-md ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
