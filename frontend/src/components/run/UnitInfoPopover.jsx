import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Shield, Swords, ShieldHalf, Gauge, Crosshair, Users, Crown, Sparkles, Timer, Target, ShieldCheck } from 'lucide-react';
import { SKILL_IMAGES } from '../CardChoice';
import { LANE_NAMES, SCOPE_LABEL, factionTone, getPortrait, getTroopArt, pct } from '../../utils/battleVisuals';
import { EffectList, EffectSpecChips, PassiveBlock } from './StatusEffects';

const PANEL_W = 340;
const GAP = 12;

const TARGET_LABEL = {
  single_enemy: 'one enemy',
  all_enemies: 'all enemies',
  self: 'self',
  all_allies: 'all allies',
  lowest_hp_ally: 'weakest ally',
};

function prettyTroop(id = '') {
  return id.replace(/^troop_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function effectLines(card) {
  const lines = [];
  const target = TARGET_LABEL[card.target_type] || card.target_type;
  if (card.power_multiplier > 0) lines.push(`Deals ${Math.round(card.power_multiplier * 100)}% ATK to ${target}`);
  if (card.heal_multiplier > 0) lines.push(`Heals ${Math.round(card.heal_multiplier * 100)}% ATK (${card.target_type === 'all_allies' ? 'all allies' : 'weakest ally'})`);
  if (card.shield_grant > 0) lines.push(`Grants +${card.shield_grant} shields`);
  if (card.summon_troop_id) lines.push(`Summons a ${prettyTroop(card.summon_troop_id)} pack`);
  return lines;
}

function Stat({ icon: Icon, label, value, accent = 'text-slate-100', mod }) {
  // `mod` = { value, pct } when buffs / debuffs / passives change the stat.
  const up = mod && mod.pct > 0;
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-900/80 border border-slate-800 px-2 py-1.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="font-mono text-[10px] text-slate-400 uppercase">{label}</span>
      <span className="ml-auto text-right">
        <span className={`font-orbitron font-bold text-xs ${mod ? (up ? 'text-emerald-300' : 'text-red-300') : accent}`}>
          {mod ? mod.value : value}
        </span>
        {mod && (
          <span className={`block font-mono text-[9px] leading-none ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '+' : ''}{Math.round(mod.pct * 100)}% · base {value}
          </span>
        )}
      </span>
    </div>
  );
}

function AbilityRow({ card }) {
  const img = SKILL_IMAGES[card.name];
  const cd = card.cooldown_remaining || 0;
  return (
    <div className={`rounded-lg border p-2 ${card.summon_troop_id ? 'border-emerald-600/50 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/70'}`}>
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 shrink-0 rounded bg-black/60 border border-slate-700 overflow-hidden flex items-center justify-center">
          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : card.summon_troop_id ? <Users className="w-5 h-5 text-emerald-300" /> : <Sparkles className="w-5 h-5 text-cyan-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-orbitron font-bold text-xs text-slate-100">{card.name}</span>
            <span className="font-mono text-[9px] px-1 rounded border border-cyan-500/50 text-cyan-300 bg-cyan-950/40">
              {SCOPE_LABEL[card.lane_scope] || 'LANE'}
            </span>
            {card.cooldown_turns > 0 && (
              <span className={`flex items-center gap-0.5 font-mono text-[9px] px-1 rounded border ${cd > 0 ? 'border-amber-500/60 text-amber-300' : 'border-slate-600 text-slate-400'}`}>
                <Timer className="w-2.5 h-2.5" /> {cd > 0 ? `${cd} left` : `CD ${card.cooldown_turns}`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{card.description}</p>
          {effectLines(card).map((l) => (
            <div key={l} className="font-mono text-[10px] text-emerald-300/90">• {l}</div>
          ))}
          {card.effects?.map((e, i) => (
            <div key={i} className={`font-mono text-[10px] ${e.is_buff ? 'text-cyan-300/90' : 'text-red-300/90'}`}>• {e.description}</div>
          ))}
          <div className="mt-1"><EffectSpecChips effects={card.effects} /></div>
          {card.flavor_quote && <div className="text-[10px] italic text-slate-500 mt-0.5">“{card.flavor_quote}”</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Detail panel anchored next to a clicked unit. Re-renders with live unit data;
 * closes on Escape, backdrop click or the close button.
 */
export default function UnitInfoPopover({ unit, anchorEl, ownerName, onClose }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: 0 });

  useLayoutEffect(() => {
    if (!anchorEl || !panelRef.current) return;
    const a = anchorEl.getBoundingClientRect();
    const h = panelRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_W, vw - 2 * GAP);
    let left = a.right + GAP;
    if (left + width > vw - GAP) left = a.left - GAP - width;      // flip to the left side
    if (left < GAP) left = Math.max(GAP, (vw - width) / 2);         // narrow screens: centre
    let top = a.top + a.height / 2 - h / 2;
    top = Math.max(GAP, Math.min(top, vh - h - GAP));
    setPos({ left, top });
  }, [anchorEl, unit]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!unit) return null;
  const enemy = unit.side === 'ENEMY';
  const isHero = unit.kind === 'HERO';
  const tone = factionTone(unit.faction);
  const art = isHero && !enemy ? getPortrait(unit.name) : getTroopArt(unit);
  const hpRatio = unit.hp / Math.max(1, unit.max_hp);

  return createPortal(
    <div className="fixed inset-0 z-[60]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div
        ref={panelRef}
        onMouseDown={(e) => e.stopPropagation()}
        className={`absolute max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border-2 shadow-2xl bg-gradient-to-b from-[#0b1426] to-[#05080f] ${
          enemy ? 'border-red-500/60 shadow-red-900/40' : `${tone.border} shadow-cyan-900/40`
        }`}
        style={{ left: pos.left, top: pos.top, width: Math.min(PANEL_W, window.innerWidth - 2 * GAP) }}
      >
        {/* Header */}
        <div className="flex gap-3 p-3 border-b border-slate-800">
          <div className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 bg-black ${enemy ? 'border-red-500/70' : tone.border}`}>
            {art ? <img src={art} alt="" className="w-full h-full object-cover object-top" /> : <Swords className={`w-10 h-10 m-5 ${tone.text}`} />}
            {enemy && <div className="absolute inset-0 bg-red-600/25 mix-blend-color" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={`font-orbitron font-black text-sm leading-tight ${enemy ? 'text-red-200' : 'text-slate-100'}`}>{unit.name}</h4>
              <button onClick={onClose} className="p-1 -m-1 rounded hover:bg-slate-800 text-slate-400 shrink-0" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {unit.title && <div className="text-[11px] text-slate-400">{unit.title}</div>}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`font-mono text-[9px] px-1.5 rounded border ${enemy ? 'border-red-500/60 text-red-300' : 'border-cyan-500/50 text-cyan-300'}`}>
                {enemy ? 'HOSTILE' : 'ALLY'} {isHero ? 'HERO' : 'TROOPS'}
              </span>
              {unit.role && <span className="font-mono text-[9px] px-1.5 rounded border border-slate-600 text-slate-300">{unit.role}</span>}
              {unit.faction && unit.faction !== 'Hostile' && <span className={`font-mono text-[9px] px-1.5 rounded border ${tone.border} ${tone.text}`}>{unit.faction}</span>}
              {unit.is_boss && <span className="flex items-center gap-0.5 font-mono text-[9px] px-1.5 rounded border border-amber-400/70 text-amber-300"><Crown className="w-2.5 h-2.5" />BOSS</span>}
              {!unit.is_boss && unit.is_elite && <span className="font-mono text-[9px] px-1.5 rounded border border-amber-400/70 text-amber-300">ELITE</span>}
              {!unit.is_alive && <span className="font-mono text-[9px] px-1.5 rounded border border-red-500 text-red-400">{isHero ? 'KIA' : 'DESTROYED'}</span>}
            </div>
            <div className="font-mono text-[10px] text-slate-500 mt-1">
              {unit.lane !== null && unit.lane !== undefined ? LANE_NAMES[unit.lane] : 'RESERVE'}
              {ownerName && <> · led by <span className="text-slate-300">{ownerName}</span></>}
            </div>
          </div>
        </div>

        {/* Vitals */}
        <div className="p-3 space-y-1.5">
          <div className="relative h-5 rounded-full bg-slate-950 border border-slate-700 overflow-hidden">
            <div className={`h-full ${hpRatio < 0.3 ? 'bg-red-500' : hpRatio < 0.6 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct(unit.hp, unit.max_hp)}%` }} />
            <span className="absolute inset-0 flex items-center justify-center font-orbitron font-bold text-[11px] text-white drop-shadow">
              {unit.hp} / {unit.max_hp} HP
            </span>
          </div>
          {unit.max_shields > 0 && (
            <div className="relative h-3.5 rounded-full bg-slate-950 border border-slate-700 overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${pct(unit.shields, unit.max_shields)}%` }} />
              <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-[9px] text-white drop-shadow">
                {unit.shields} / {unit.max_shields} SHIELDS
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
          {isHero ? (
            <>
              <Stat icon={Swords} label="Attack" value={unit.attack} accent="text-red-300" mod={unit.modified?.attack} />
              <Stat icon={ShieldHalf} label="Defense" value={unit.defense} mod={unit.modified?.defense} />
              <Stat icon={Gauge} label="Speed" value={unit.speed} accent="text-amber-300" mod={unit.modified?.speed} />
              <Stat icon={Timer} label="Initiative" value={unit.is_alive ? `${Math.round(Math.min(100, unit.turn_meter))}%` : '—'} />
              {unit.crit_rate !== undefined && <Stat icon={Crosshair} label="Crit rate" value={`${Math.round(unit.crit_rate * 100)}%`} />}
              {unit.crit_damage !== undefined && <Stat icon={Crosshair} label="Crit dmg" value={`×${unit.crit_damage}`} />}
              <Stat icon={Target} label="Accuracy" value={unit.accuracy ?? 0} accent="text-sky-300" />
              <Stat icon={ShieldCheck} label="Resist" value={unit.resistance ?? 0} accent="text-violet-300" />
            </>
          ) : (
            <>
              <Stat icon={Users} label="Soldiers" value={`${unit.count} / ${unit.max_count}`} accent="text-cyan-200" />
              <Stat icon={Swords} label="Volley" value={unit.volley_power} accent="text-red-300" mod={unit.modified?.attack} />
              <Stat icon={Heart} label="HP / soldier" value={unit.unit_hp} />
              <Stat icon={Swords} label="ATK / soldier" value={unit.unit_attack} />
              <Stat icon={ShieldHalf} label="Defense" value={unit.defense} mod={unit.modified?.defense} />
              <Stat icon={ShieldCheck} label="Resist" value={unit.resistance ?? 0} accent="text-violet-300" />
              {unit.shields > 0 && <Stat icon={Shield} label="Shields" value={unit.shields} accent="text-cyan-300" />}
            </>
          )}
        </div>

        {/* Passive & status effects */}
        <div className="px-3 pb-3 space-y-2">
          {unit.passive && <PassiveBlock passive={unit.passive} stacks={unit.passive_stacks} compact />}
          <div>
            <div className="font-mono text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Buffs & debuffs</div>
            <EffectList effects={unit.effects} />
          </div>
        </div>

        {/* Abilities / behaviour */}
        <div className="px-3 pb-3">
          <div className="font-mono text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">{isHero ? 'Abilities' : 'Behaviour'}</div>
          {isHero && unit.cards?.length > 0 ? (
            <div className="space-y-1.5">
              {unit.cards.map((c) => <AbilityRow key={c.id} card={c} />)}
            </div>
          ) : isHero ? (
            <p className="text-[11px] text-slate-300 leading-snug">
              Strikes the unit in front of it in its lane{unit.is_elite || unit.is_boss ? ' with +20% power' : ''}. If its lane is empty, it fires into a neighbouring lane.
            </p>
          ) : (
            <p className="text-[11px] text-slate-300 leading-snug">
              Stays in its lane. Fires one volley (soldiers × ATK) at the front enemy each time its lane&apos;s hero acts — or on its own slower drill meter if the lane has no hero. Shields the hero behind it: enemies must cut through troops first.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
