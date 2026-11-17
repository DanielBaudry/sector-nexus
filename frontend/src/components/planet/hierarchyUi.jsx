import React from 'react';
import { Lock, Crosshair, Skull, Crown, Swords } from 'lucide-react';

// Status look & copy for hierarchy champions.
export const STATUS_META = {
  LOCKED: { label: 'PROTECTED', color: '#64748b', icon: Lock, hint: 'Shielded by their subordinates' },
  HUNTED: { label: 'HUNTABLE', color: '#22d3ee', icon: Crosshair, hint: 'Gather Influence through expeditions' },
  VULNERABLE: { label: 'VULNERABLE', color: '#f97316', icon: Swords, hint: 'Boss fight unlocked' },
  DEFEATED: { label: 'DEFEATED', color: '#eab308', icon: Crown, hint: 'Seat claimed' },
};

export const RANK_LABEL = { OVERLORD: 'Overlord', LIEUTENANT: 'Lieutenant', CAPTAIN: 'Captain' };

export function ChampionArt({ champion, className = '' }) {
  return (
    <img
      src={champion.image}
      alt={champion.name}
      className={className}
      style={{ filter: `hue-rotate(${champion.art_hue || 0}deg)${champion.status === 'DEFEATED' ? ' grayscale(0.85) brightness(0.7)' : champion.status === 'LOCKED' ? ' brightness(0.45) saturate(0.4)' : ''}` }}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

export function StatusBadge({ status, size = 'sm' }) {
  const meta = STATUS_META[status] || STATUS_META.LOCKED;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-mono font-bold ${size === 'sm' ? 'text-[11px] px-1.5 py-px' : 'text-[13px] px-2 py-0.5'}`}
      style={{ color: meta.color, borderColor: `${meta.color}99`, backgroundColor: `${meta.color}1a` }}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} /> {meta.label}
    </span>
  );
}

export function InfluenceBar({ value, max, height = 'h-2', showText = false }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  const full = value >= max;
  return (
    <div className="w-full">
      <div className={`relative w-full ${height} rounded-full bg-slate-950 border border-black/60 overflow-hidden`}>
        <div
          className={`h-full transition-all duration-500 ${full ? 'bg-gradient-to-r from-orange-500 to-amber-300' : 'bg-gradient-to-r from-cyan-700 to-cyan-400'}`}
          style={{ width: `${pct}%` }}
        />
        {showText && (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold text-white" style={{ textShadow: '0 0 3px #000' }}>
            {value} / {max}
          </span>
        )}
      </div>
    </div>
  );
}

/** Adaptation pips: how many times this champion beat the player (max 3). */
export function AdaptationPips({ losses = 0, max = 3 }) {
  if (!losses) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`Adapted ${losses} time(s) after beating you`}>
      {Array.from({ length: max }).map((_, i) => (
        <Skull key={i} className={`w-3 h-3 ${i < losses ? 'text-red-400' : 'text-slate-700'}`} />
      ))}
    </span>
  );
}
