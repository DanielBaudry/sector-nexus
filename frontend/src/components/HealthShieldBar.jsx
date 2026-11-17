import React from 'react';
import { Shield } from 'lucide-react';

export default function HealthShieldBar({
  hp = 0,
  maxHp = 100,
  shields = 0,
  maxShields = 0,
  turnMeter = 0,
  showTurnMeter = true,
  name,
  isAlive = true
}) {
  const hpPercent = Math.min(100, Math.max(0, (hp / Math.max(1, maxHp)) * 100));
  const shieldPercent = maxShields > 0 ? Math.min(100, Math.max(0, (shields / maxShields) * 100)) : 0;
  const meterPercent = Math.min(100, Math.max(0, turnMeter));

  return (
    <div className={`flex flex-col gap-1 w-full font-mono text-[13px] ${!isAlive ? 'opacity-40 grayscale' : ''}`}>
      {/* Name and Status */}
      <div className="flex items-center justify-between text-slate-300">
        <span className="font-semibold truncate">{name}</span>
        <div className="flex items-center gap-2">
          {maxShields > 0 && (
            <span className="text-cyan-400 flex items-center gap-0.5">
              <Shield className="w-3 h-3 inline" /> {shields}/{maxShields}
            </span>
          )}
          <span className={hpPercent < 30 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
            {hp}/{maxHp} HP
          </span>
        </div>
      </div>

      {/* Shields Bar (if unit has shields) */}
      {maxShields > 0 && (
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/30">
          <div
            className="h-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)] transition-all duration-200"
            style={{ width: `${shieldPercent}%` }}
          />
        </div>
      )}

      {/* HP Bar */}
      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
        <div
          className={`h-full transition-all duration-200 ${
            hpPercent < 30
              ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
              : hpPercent < 60
              ? 'bg-amber-400'
              : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
          }`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>

      {/* Turn Initiative Meter */}
      {showTurnMeter && isAlive && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-amber-400 uppercase">INIT</span>
          <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-amber-500/20">
            <div
              className="h-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all duration-100"
              style={{ width: `${meterPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
