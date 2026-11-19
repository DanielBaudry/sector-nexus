import React from 'react';
import { Crown, Hourglass, Lock, AlertTriangle, Flame, Skull, Droplets, Bug, Mountain, Zap, Shield, Heart, Swords } from 'lucide-react';
import { LANE_NAMES, getBossArt, pct } from '../../utils/battleVisuals';
import { AimMarker, Bar, FxWrap, aimClasses } from './LaneUnits';
import { EffectBadges } from './StatusEffects';

const ICONS = { Flame, Skull, Droplets, Bug, Mountain, Shield, Heart, Swords };

/** Boss HP bar with phase thresholds marked on it. */
function PhaseBar({ hp, maxHp, phases = [], phase = 0 }) {
  const ratio = hp / Math.max(1, maxHp);
  return (
    <div className="relative w-full h-6 bg-slate-950 rounded-md overflow-hidden border border-black/80 shadow-inner">
      <div
        className={`h-full transition-all duration-300 ${ratio < 0.3 ? 'bg-gradient-to-r from-red-700 to-red-500' : ratio < 0.6 ? 'bg-gradient-to-r from-orange-700 to-amber-500' : 'bg-gradient-to-r from-red-800 to-orange-500'}`}
        style={{ width: `${pct(hp, maxHp)}%` }}
      />
      {phases.slice(1).map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 bottom-0 w-0.5 ${i + 1 <= phase ? 'bg-slate-500/60' : 'bg-white/90'}`}
          style={{ left: `${p.threshold * 100}%` }}
          title={`Phase ${i + 2} — ${p.name} at ${Math.round(p.threshold * 100)}%`}
        />
      ))}
      <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-sm text-white"
        style={{ textShadow: '0 0 4px #000, 0 0 2px #000' }}>
        {hp.toLocaleString()} / {maxHp.toLocaleString()} · {Math.ceil(ratio * 100)}%
      </span>
    </div>
  );
}

function BossAbility({ card, bossPhase, charging }) {
  const locked = (card.phase || 0) > bossPhase;
  const cd = card.cooldown_remaining || 0;
  const Icon = ICONS[card.icon_name] || Zap;
  return (
    <div
      title={`${card.name}${card.telegraph_turns ? ` (winds up ${card.telegraph_turns} turn${card.telegraph_turns > 1 ? 's' : ''})` : ''} — ${card.description}`}
      className={`relative w-[clamp(64px,5.4vw,88px)] shrink-0 rounded-lg border-2 overflow-hidden text-center ${
        charging ? 'border-orange-300 ring-2 ring-orange-400 animate-pulse bg-orange-950/70'
          : locked ? 'border-slate-800 bg-slate-950/80'
          : cd > 0 ? 'border-slate-700 bg-black/70'
          : card.telegraph_turns ? 'border-orange-500/70 bg-gradient-to-b from-orange-950/70 to-black'
          : 'border-red-600/60 bg-gradient-to-b from-red-950/70 to-black'
      }`}
    >
      <div className="h-8 flex items-center justify-center">
        <Icon className={`w-5 h-5 ${locked ? 'text-slate-700' : 'text-orange-200'}`} />
      </div>
      <div className={`px-1 pb-1 font-orbitron font-bold text-[11px] leading-tight truncate ${locked ? 'text-slate-600' : 'text-slate-100'}`}>
        {card.name}
      </div>
      {card.telegraph_turns > 0 && !locked && (
        <Hourglass className="absolute top-0.5 left-0.5 w-3 h-3 text-orange-300" />
      )}
      {locked ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 font-mono text-[11px] text-slate-400">
          <Lock className="w-3.5 h-3.5" /> P{card.phase + 1}
        </span>
      ) : cd > 0 && !charging ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 font-orbitron font-black text-lg text-slate-200">
          {cd}
          <span className="font-mono font-normal text-[10px] text-slate-400 -mt-1">TURNS</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * The colossal boss, drawn once across the top of all three lanes.
 * Clicking it inspects it, or targets it while an ability is armed.
 */
export default function BossBanner({ boss, fx, onInspect, targetable = null, dimmed = false }) {
  const intent = boss.intent;
  const phase = boss.phases?.[boss.phase] || null;
  const alive = boss.is_alive;
  const onClick = onInspect ? (e) => { if (onInspect(boss, e.currentTarget)) e.stopPropagation(); } : undefined;

  return (
    <FxWrap unit={boss} fx={fx} className="shrink-0">
      <div
        onClick={onClick}
        className={`relative rounded-xl border-2 overflow-hidden transition-all ${aimClasses(targetable, dimmed)} ${
          intent ? 'border-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.35)]' : 'border-red-700/80'
        } ${onInspect ? 'cursor-pointer' : ''} ${!alive ? 'opacity-40 grayscale' : ''}`}
        style={{ background: 'radial-gradient(ellipse at 18% 50%, rgba(249,115,22,0.22), transparent 55%), linear-gradient(90deg, #1a0805, #0b0507 55%, #050308)' }}
      >
        <div className="flex items-stretch gap-3 p-2 min-h-[clamp(110px,17vh,170px)]">
          {/* Art */}
          <div className="relative w-[clamp(110px,16vh,190px)] shrink-0 flex items-center justify-center">
            <img src={boss.art?.image || getBossArt(boss.name)} alt={boss.name}
              style={{ filter: boss.art?.hue ? `hue-rotate(${boss.art.hue}deg)` : undefined }} className="max-h-[clamp(110px,17vh,170px)] w-full object-contain drop-shadow-[0_0_18px_rgba(249,115,22,0.5)]" />
            {!alive && <Skull className="absolute w-1/2 h-1/2 text-red-500/80" />}
            <AimMarker targetable={targetable} />
          </div>

          {/* Vitals */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1 px-1.5 rounded bg-black/80 border border-amber-400/70 text-amber-300 font-mono text-[12px] font-bold shrink-0">
                <Crown className="w-3.5 h-3.5" /> BOSS
              </span>
              <span className="font-orbitron font-black text-lg text-red-100 truncate">{boss.name}</span>
              {boss.title && <span className="font-orbitron text-[13px] text-orange-200/70 truncate hidden md:inline">{boss.title}</span>}
              {phase && (
                <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/60 font-mono text-[12px] text-red-200">
                  PHASE {boss.phase + 1}/{boss.phases.length} · {phase.name.toUpperCase()}
                </span>
              )}
            </div>
            {boss.max_shields > 0 && boss.shields > 0 && (
              <Bar value={boss.shields} max={Math.max(boss.shields, boss.max_shields)} className="bg-cyan-400" height="h-1.5" />
            )}
            <PhaseBar hp={boss.hp} maxHp={boss.max_hp} phases={boss.phases} phase={boss.phase} />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500 shrink-0">TURN</span>
              <div className="flex-1"><Bar value={boss.turn_meter} max={100} className="bg-amber-400" height="h-1.5" /></div>
            </div>
            <div className="flex items-center gap-2 min-h-[22px]">
              {alive && boss.effects?.length > 0 && <EffectBadges effects={boss.effects} size="lg" />}
              {boss.passive && (
                <span className="font-mono text-[12px] text-violet-300 truncate" title={boss.passive.description}>
                  ★ {boss.passive.name}{boss.passive_stacks ? ` ×${boss.passive_stacks}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Abilities + intent */}
          <div className="hidden md:flex flex-col justify-center gap-1.5 shrink-0 max-w-[48%]">
            {intent ? (
              <div className="rounded-lg border-2 border-orange-400 bg-orange-950/80 px-3 py-1.5 animate-pulse">
                <div className="flex items-center gap-1.5 font-orbitron font-black text-sm text-orange-100">
                  <AlertTriangle className="w-4 h-4 text-orange-300" />
                  {intent.name.toUpperCase()}
                </div>
                <div className="font-mono text-[12px] text-orange-200">
                  → {intent.lanes.length === 3 ? 'ALL LANES' : intent.lanes.map((l) => LANE_NAMES[l]).join(' + ')} · in {intent.turns} boss turn{intent.turns > 1 ? 's' : ''}
                </div>
                <div className="font-mono text-[11px] text-orange-300/80">Brace the lane — or STUN to interrupt</div>
              </div>
            ) : (
              <div className="font-mono text-[11px] text-slate-500 tracking-widest">ABILITIES</div>
            )}
            <div className="flex gap-1.5 overflow-x-auto">
              {(boss.cards || []).map((c) => (
                <BossAbility key={c.id} card={c} bossPhase={boss.phase || 0} charging={intent?.card_id === c.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </FxWrap>
  );
}
