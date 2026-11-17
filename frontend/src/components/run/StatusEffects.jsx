import React from 'react';
import {
  Swords, Shield, Gauge, Crosshair, ShieldCheck, HeartPulse, ShieldOff, Snail, Flame, Biohazard,
  Zap, HeartOff, Target, Sparkles, Eraser, Magnet, Star,
} from 'lucide-react';

// Icon + colour per effect type (buffs green/cyan, debuffs red/orange/purple).
export const EFFECT_META = {
  ATK_UP: { icon: Swords, color: '#4ade80' },
  DEF_UP: { icon: Shield, color: '#4ade80' },
  SPD_UP: { icon: Gauge, color: '#4ade80' },
  CRIT_UP: { icon: Crosshair, color: '#4ade80' },
  IMMUNITY: { icon: ShieldCheck, color: '#22d3ee' },
  REGEN: { icon: HeartPulse, color: '#34d399' },
  ATK_DOWN: { icon: Swords, color: '#f87171' },
  DEF_DOWN: { icon: ShieldOff, color: '#f87171' },
  SPD_DOWN: { icon: Snail, color: '#f87171' },
  BURN: { icon: Flame, color: '#fb923c' },
  POISON: { icon: Biohazard, color: '#a3e635' },
  STUN: { icon: Zap, color: '#facc15' },
  HEAL_BLOCK: { icon: HeartOff, color: '#f472b6' },
  MARKED: { icon: Target, color: '#f87171' },
  CLEANSE: { icon: Sparkles, color: '#22d3ee' },
  STRIP: { icon: Eraser, color: '#c084fc' },
  STEAL: { icon: Magnet, color: '#c084fc' },
};

const metaFor = (type) => EFFECT_META[type] || { icon: Star, color: '#94a3b8' };

/** Groups same-type effects (DoT stacks) into one badge with a stack count. */
function grouped(effects = []) {
  const map = new Map();
  effects.forEach((e) => {
    const g = map.get(e.type);
    if (g) {
      g.stacks += 1;
      g.turns = Math.max(g.turns, e.turns);
      g.value += e.value;
    } else {
      map.set(e.type, { ...e, stacks: 1 });
    }
  });
  // Buffs first, then debuffs.
  return [...map.values()].sort((a, b) => Number(b.is_buff) - Number(a.is_buff));
}

/** Compact buff / debuff row shown on lane tiles: icon, turns left, stack count. */
export function EffectBadges({ effects, size = 'md', max = 6 }) {
  const list = grouped(effects);
  if (!list.length) return null;
  const box = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const shown = list.slice(0, max);
  return (
    <div className="flex flex-wrap justify-center gap-0.5">
      {shown.map((e) => {
        const { icon: Icon, color } = metaFor(e.type);
        return (
          <span
            key={e.type}
            title={`${e.label}${e.stacks > 1 ? ` ×${e.stacks}` : ''} — ${e.description} (${e.turns} turn${e.turns > 1 ? 's' : ''})`}
            className={`relative ${box} rounded flex items-center justify-center bg-black/85 border`}
            style={{ borderColor: color, boxShadow: `0 0 5px ${color}66` }}
          >
            <Icon className={icon} style={{ color }} />
            {!e.is_buff && <span className="absolute -top-px -left-px w-1 h-1 rounded-full bg-red-500" />}
            <span className="absolute -bottom-1 -right-1 min-w-[12px] px-px rounded-sm bg-black text-[10px] font-mono font-bold leading-[12px] text-white text-center">
              {e.turns}
            </span>
            {e.stacks > 1 && (
              <span className="absolute -top-1 -right-1 px-px rounded-sm bg-black text-[9px] font-mono leading-[10px]" style={{ color }}>
                ×{e.stacks}
              </span>
            )}
          </span>
        );
      })}
      {list.length > max && <span className="text-[11px] font-mono text-slate-400">+{list.length - max}</span>}
    </div>
  );
}

/** Small passive marker for hero tiles. */
export function PassiveMark({ passive, stacks = 0 }) {
  if (!passive) return null;
  return (
    <span
      title={`PASSIVE — ${passive.name}: ${passive.description}${stacks ? ` (stacks: ${stacks})` : ''}`}
      className="absolute top-1 right-1 flex items-center gap-0.5 text-[11px] font-mono font-bold px-1 rounded bg-black/85 text-violet-200 border border-violet-400/60"
    >
      <Star className="w-2.5 h-2.5 fill-violet-300 text-violet-300" />
      {stacks > 0 && stacks}
    </span>
  );
}

/** Chips summarising what an ability applies (used on ability cards). */
export function EffectSpecChips({ effects, size = 'sm' }) {
  if (!effects?.length) return null;
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';
  return (
    <div className="flex flex-wrap gap-0.5">
      {effects.map((e, i) => {
        const { icon: Icon, color } = metaFor(e.type);
        return (
          <span
            key={`${e.type}-${i}`}
            title={e.description}
            className={`inline-flex items-center gap-0.5 px-1 rounded border bg-black/60 font-mono ${text} leading-tight`}
            style={{ borderColor: `${color}99`, color }}
          >
            <Icon className="w-2.5 h-2.5" />
            {e.label}
            {e.chance < 1 && !e.is_buff && <span className="opacity-70">{Math.round(e.chance * 100)}%</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Full list of active effects for the unit info panel. */
export function EffectList({ effects }) {
  const list = grouped(effects);
  if (!list.length) return <div className="font-mono text-[12px] text-slate-500">No active effects.</div>;
  return (
    <div className="space-y-1">
      {list.map((e) => {
        const { icon: Icon, color } = metaFor(e.type);
        return (
          <div key={e.type} className="flex items-center gap-2 rounded-md bg-slate-900/80 border px-2 py-1" style={{ borderColor: `${color}55` }}>
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            <span className="font-mono text-[12px] font-bold" style={{ color }}>
              {e.label}{e.stacks > 1 ? ` ×${e.stacks}` : ''}
            </span>
            <span className="text-[12px] text-slate-300 truncate">{e.description}</span>
            <span className="ml-auto font-mono text-[12px] text-slate-400 shrink-0">{e.turns}t</span>
          </div>
        );
      })}
    </div>
  );
}

/** Passive description block (popover / armory). */
export function PassiveBlock({ passive, stacks = 0, compact = false }) {
  if (!passive) return null;
  return (
    <div className={`rounded-lg border border-violet-500/40 bg-violet-950/30 ${compact ? 'px-2 py-1.5' : 'p-2.5'}`}>
      <div className="flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 fill-violet-300 text-violet-300 shrink-0" />
        <span className="font-mono text-[12px] text-violet-400 tracking-wider">PASSIVE</span>
        <span className="font-orbitron font-bold text-xs text-violet-100 truncate">{passive.name}</span>
        {stacks > 0 && <span className="ml-auto font-mono text-[12px] text-violet-300">×{stacks}</span>}
      </div>
      <p className={`text-slate-300 leading-snug mt-0.5 ${compact ? 'text-[13px]' : 'text-xs'}`}>{passive.description}</p>
    </div>
  );
}
