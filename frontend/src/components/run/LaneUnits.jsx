import React from 'react';
import { Crown, Swords, Skull, Crosshair } from 'lucide-react';
import { factionTone, getPortrait, getTroopArt, pct } from '../../utils/battleVisuals';

function Bar({ value, max, className, height = 'h-1.5' }) {
  return (
    <div className={`w-full ${height} bg-slate-950 rounded-full overflow-hidden border border-black/60`}>
      <div className={`h-full transition-all duration-300 ${className}`} style={{ width: `${pct(value, max)}%` }} />
    </div>
  );
}

/** Life bar with the value written inside it. */
function LifeBar({ hp, maxHp, height = 'h-3.5', text = 'text-[10px]' }) {
  return (
    <div className={`relative w-full ${height} bg-slate-950 rounded-full overflow-hidden border border-black/60`}>
      <div className={`h-full transition-all duration-300 ${hpColor(hp / Math.max(1, maxHp))}`} style={{ width: `${pct(hp, maxHp)}%` }} />
      <span className={`absolute inset-0 flex items-center justify-center font-mono font-bold leading-none text-white ${text}`}
        style={{ textShadow: '0 0 3px #000, 0 0 2px #000' }}>
        {hp}
      </span>
    </div>
  );
}

function inspectHandler(unit, onInspect) {
  if (!onInspect) return undefined;
  // Returns true when the click was consumed (so lane targeting/deploy clicks still work otherwise).
  return (e) => { if (onInspect(unit, e.currentTarget)) e.stopPropagation(); };
}

/** Highlight while an ability is armed: pulsing ring + crosshair on valid targets, dim the rest. */
function aimClasses(targetable, dimmed) {
  if (targetable === 'enemy') return 'ring-4 ring-red-400 ring-offset-2 ring-offset-black cursor-crosshair';
  if (targetable === 'ally') return 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-black cursor-crosshair';
  if (dimmed) return 'opacity-40';
  return '';
}

function AimMarker({ targetable }) {
  if (!targetable) return null;
  return (
    <span className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none`}>
      <Crosshair className={`w-1/2 h-1/2 animate-pulse drop-shadow ${targetable === 'enemy' ? 'text-red-300' : 'text-emerald-300'}`} />
    </span>
  );
}

function hpColor(ratio) {
  if (ratio < 0.3) return 'bg-red-500';
  if (ratio < 0.6) return 'bg-amber-400';
  return 'bg-emerald-500';
}

// Frame colours (outer gradient ring) per allegiance.
function frameFor(unit) {
  if (unit.side === 'ENEMY') {
    return unit.is_boss
      ? { ring: 'from-amber-300 via-red-500 to-red-900', glow: 'shadow-red-500/50', accent: 'border-amber-300' }
      : { ring: 'from-red-400 via-red-700 to-red-950', glow: 'shadow-red-700/40', accent: 'border-red-400' };
  }
  const f = unit.faction || '';
  if (f.includes('Terran')) return { ring: 'from-sky-300 via-sky-600 to-slate-900', glow: 'shadow-sky-500/40', accent: 'border-sky-300' };
  if (f.includes('Bio')) return { ring: 'from-fuchsia-300 via-purple-600 to-slate-900', glow: 'shadow-purple-500/40', accent: 'border-fuchsia-300' };
  if (f.includes('Astral')) return { ring: 'from-amber-200 via-amber-500 to-slate-900', glow: 'shadow-amber-500/40', accent: 'border-amber-200' };
  return { ring: 'from-cyan-300 via-cyan-600 to-slate-900', glow: 'shadow-cyan-500/40', accent: 'border-cyan-300' };
}

/** Framed hero card: portrait centred, info strip attached underneath. */
function HeroCard({ unit, isActive = false, onInspect, targetable = null, dimmed = false }) {
  const enemy = unit.side === 'ENEMY';
  const alive = unit.is_alive;
  const frame = frameFor(unit);
  const tone = factionTone(unit.faction);
  const portrait = enemy ? getTroopArt(unit) : getPortrait(unit.name);
  const corner = `absolute w-3 h-3 ${frame.accent}`;

  return (
    <div
      onClick={inspectHandler(unit, onInspect)}
      className={`relative mx-auto w-[clamp(72px,12vh,136px)] rounded-xl transition-all ${aimClasses(targetable, dimmed)} ${onInspect ? 'cursor-pointer hover:brightness-125' : ''} ${
        !alive ? 'opacity-35 grayscale' : ''
      } ${isActive ? 'scale-105' : ''}`}
    >
      {/* Frame: gradient ring + corner brackets */}
      <div
        className={`rounded-xl p-[3px] bg-gradient-to-b ${frame.ring} shadow-lg ${frame.glow} ${
          isActive ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black animate-pulse' : ''
        }`}
      >
        <div className="rounded-[9px] overflow-hidden bg-black">
          <div className="relative aspect-square bg-gradient-to-b from-slate-800 to-black flex items-center justify-center">
            {portrait ? (
              <img
                src={portrait}
                alt={unit.name}
                className="w-full h-full object-cover object-top"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <Swords className={`w-1/2 h-1/2 ${tone.text}`} />
            )}
            {enemy && <div className="absolute inset-0 bg-red-600/25 mix-blend-color pointer-events-none" />}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
            {!alive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Skull className="w-1/3 h-1/3 text-red-500/80" />
              </div>
            )}
            {(unit.is_boss || unit.is_elite) && (
              <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[10px] font-mono font-bold px-1 rounded bg-black/80 text-amber-300 border border-amber-400/60">
                {unit.is_boss && <Crown className="w-3 h-3" />}
                {unit.is_boss ? 'BOSS' : 'ELITE'}
              </span>
            )}
          </div>

          {/* Attached info strip */}
          <div className="px-1.5 pt-1 pb-1.5 bg-gradient-to-b from-slate-900 to-black border-t border-white/10">
            <div className={`font-orbitron font-bold text-[11px] leading-tight text-center truncate ${enemy ? 'text-red-200' : 'text-slate-100'}`}>
              {unit.name}
            </div>
            {unit.max_shields > 0 && <div className="mt-1"><Bar value={unit.shields} max={unit.max_shields} className="bg-cyan-400" height="h-1" /></div>}
            <div className="mt-1"><LifeBar hp={unit.hp} maxHp={unit.max_hp} /></div>
            {alive && <div className="mt-1"><Bar value={unit.turn_meter} max={100} className="bg-amber-400" height="h-1" /></div>}
          </div>
        </div>
      </div>
      <span className={`${corner} -top-1 -left-1 border-t-2 border-l-2 rounded-tl`} />
      <span className={`${corner} -top-1 -right-1 border-t-2 border-r-2 rounded-tr`} />
      <span className={`${corner} -bottom-1 -left-1 border-b-2 border-l-2 rounded-bl`} />
      <span className={`${corner} -bottom-1 -right-1 border-b-2 border-r-2 rounded-br`} />
      <AimMarker targetable={targetable} />
      {isActive && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold px-1.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-300 z-10">
          TURN
        </span>
      )}
    </div>
  );
}

/** Troop pack card: art fills ~80%, soldier count in a grey pill, life bar underneath. */
function TroopCard({ unit, onInspect, targetable = null, dimmed = false }) {
  const enemy = unit.side === 'ENEMY';
  const tone = factionTone(unit.faction);
  return (
    <div
      title={`${unit.name} — ${unit.count}/${unit.max_count} soldiers · volley ${unit.volley_power}${unit.shields > 0 ? ` · shields ${unit.shields}` : ''}`}
      onClick={inspectHandler(unit, onInspect)}
      className={`relative w-[clamp(52px,8vh,96px)] rounded-lg border-2 overflow-hidden bg-black transition-all ${aimClasses(targetable, dimmed)} ${onInspect ? 'cursor-pointer hover:brightness-125' : ''} ${
        enemy ? 'border-red-700/80' : tone.border
      }`}
    >
      <div className="relative aspect-square">
        <img src={getTroopArt(unit)} alt={unit.name} className="w-full h-full object-cover" />
        {enemy && <div className="absolute inset-0 bg-red-600/30 mix-blend-color pointer-events-none" />}
        <AimMarker targetable={targetable} />
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 min-w-[2rem] text-center px-2 py-px rounded-full bg-slate-700/90 border border-slate-400/60 font-orbitron font-black text-sm text-white shadow-md">
          {unit.count}
        </span>
      </div>
      <div className="px-1 py-1 bg-slate-950 space-y-0.5">
        {unit.shields > 0 && <Bar value={unit.shields} max={Math.max(unit.shields, unit.max_shields)} className="bg-cyan-400" height="h-1" />}
        <LifeBar hp={unit.hp} maxHp={unit.max_hp} height="h-3" text="text-[9px]" />
      </div>
    </div>
  );
}

// ── Combat FX wrapper ─────────────────────────────────────────────────────
const FLASH = {
  attack: 'bg-yellow-200/25',
  hit: 'bg-red-500/60',
  crit: 'bg-amber-400/70',
  heal: 'bg-emerald-400/50',
  shield: 'bg-cyan-400/50',
};

/**
 * Anchors the unit for screen-space FX (data-unit-id) and plays its current effect:
 * lunge toward the front when attacking, shake + flash when hit.
 * The inner node is keyed by the effect so each new effect restarts the animation.
 */
function FxWrap({ unit, fx, className = '', children }) {
  const motion = !fx ? ''
    : fx.kind === 'attack' ? (unit.side === 'ALLY' ? 'fx-attack-up' : 'fx-attack-down')
    : fx.kind === 'crit' ? 'fx-crit'
    : fx.kind === 'hit' ? 'fx-hit'
    : '';
  const flash = fx && FLASH[fx.kind];
  return (
    <div data-unit-id={unit.id} className={className}>
      <div key={fx?.key ?? 0} className={`relative ${motion}`}>
        {children}
        {flash && <span className={`absolute inset-0 rounded-xl pointer-events-none fx-flash ${flash}`} />}
      </div>
    </div>
  );
}

export function HeroTile({ fx, ...props }) {
  return (
    <FxWrap unit={props.unit} fx={fx} className="mx-auto w-fit">
      <HeroCard {...props} />
    </FxWrap>
  );
}

export function TroopTile({ fx, ...props }) {
  return (
    <FxWrap unit={props.unit} fx={fx}>
      <TroopCard {...props} />
    </FxWrap>
  );
}
