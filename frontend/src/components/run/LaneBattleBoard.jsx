import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Crosshair, Rocket, Radio, Users, Hourglass, X } from 'lucide-react';
import { api } from '../../services/api';
import TimerBar from '../TimerBar';
import { SKILL_IMAGES } from '../CardChoice';
import { EFFECT_META, EffectBadges, EffectSpecChips } from './StatusEffects';
import { HeroTile, TroopTile } from './LaneUnits';
import ObjectiveTracker from './ObjectiveTracker';
import UnitInfoPopover from './UnitInfoPopover';
import BattleFxLayer from './BattleFxLayer';
import useBattleReplay from './useBattleReplay';
import { LANE_NAMES, SCOPE_LABEL, factionTone, getPortrait, lanesInReach } from '../../utils/battleVisuals';

const STEP_PAUSE_MS = 250;   // breather between resolved actions (animations add the rest)
const EXPIRY_POLL_MS = 500;

function DrillMeter({ value, enemy }) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 font-mono text-[10px] text-slate-400 px-1" title="Leaderless troops fire on their own (slower) drill meter">
      <Radio className="w-3.5 h-3.5" /> DRILL
      <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
        <div className={`h-full ${enemy ? 'bg-red-500/70' : 'bg-cyan-500/70'}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

/** Does this ability ask the player to pick a unit (single target) or a lane (ANY_LANE)? */
function needsTarget(card) {
  return card.lane_scope === 'any_lane' || card.target_type === 'single_enemy' || card.target_type === 'lowest_hp_ally';
}

/** Which side a unit target must belong to (relative to the acting hero), or null if units can't be aimed. */
function targetSide(card) {
  if (card.summon_troop_id || card.target_type === 'self') return null;
  if (card.target_type === 'lowest_hp_ally' || card.target_type === 'all_allies') return 'ALLY';
  return 'ENEMY';
}

function AbilityCard({ card, index, disabled, selected, onPlay, onHover }) {
  const onCooldown = card.cooldown_remaining > 0;
  const img = SKILL_IMAGES[card.name];
  const isSummon = !!card.summon_troop_id;
  return (
    <button
      disabled={disabled || onCooldown}
      onClick={() => onPlay(card)}
      onMouseEnter={() => onHover(card)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(card)}
      onBlur={() => onHover(null)}
      title={[card.description, ...(card.effects || []).map((e) => `• ${e.description}`)].join('\n')}
      className={`relative shrink-0 h-full max-h-[128px] w-[clamp(84px,7.2vw,120px)] rounded-xl border-2 text-left overflow-hidden flex flex-col transition-all ${
        onCooldown
          ? 'border-slate-800 bg-slate-950 opacity-50 cursor-not-allowed'
          : selected
          ? 'border-cyan-200 ring-2 ring-cyan-300 bg-cyan-950/60 -translate-y-1'
          : isSummon
          ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 to-black hover:border-emerald-300 hover:-translate-y-1'
          : 'border-cyan-500/50 bg-gradient-to-b from-[#071a33] to-black hover:border-cyan-300 hover:-translate-y-1'
      } disabled:hover:translate-y-0`}
    >
      <div className="relative flex-1 min-h-0 bg-black/60 flex items-center justify-center overflow-hidden">
        {img ? <img src={img} alt="" className="h-full w-full object-contain p-1" /> : isSummon ? <Users className="w-1/3 h-1/3 text-emerald-300" /> : <Crosshair className="w-1/3 h-1/3 text-cyan-300" />}
        <span className="absolute top-0.5 left-0.5 font-mono text-[9px] px-1 rounded bg-black/80 border border-slate-600 text-slate-300">{index + 1}</span>
        {card.effects?.length > 0 && (
          <span className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
            {card.effects.slice(0, 3).map((e, i) => {
              const meta = EFFECT_META[e.type];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <span key={i} className="w-4 h-4 rounded flex items-center justify-center bg-black/85 border" style={{ borderColor: meta.color }}>
                  <Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
                </span>
              );
            })}
          </span>
        )}
      </div>
      <div className="shrink-0 px-1.5 py-1 border-t border-white/10">
        <div className="font-orbitron font-bold text-[10px] leading-tight text-slate-100 truncate">{card.name}</div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="font-mono text-[8px] px-1 rounded bg-black/60 border border-cyan-600/60 text-cyan-300 truncate">
            {SCOPE_LABEL[card.lane_scope] || 'LANE'}
          </span>
          {card.cooldown_turns > 0 && <span className="font-mono text-[8px] text-slate-500 shrink-0">CD{card.cooldown_turns}</span>}
        </div>
      </div>
      {onCooldown && (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 font-orbitron font-black text-slate-200">
          <span className="text-2xl">{card.cooldown_remaining}</span>
          <span className="font-mono text-[9px] text-slate-400">TURNS</span>
        </span>
      )}
    </button>
  );
}

export default function LaneBattleBoard({ run, onRunUpdated, onAnimatingChange }) {
  const battle = run.battle;
  const deploying = run.status === 'DEPLOYMENT';
  const live = run.status === 'BATTLE' && battle?.status === 'IN_PROGRESS';

  const [placement, setPlacement] = useState({});        // heroId -> lane (deployment)
  const [selectedHero, setSelectedHero] = useState(null);
  const [targeting, setTargeting] = useState(null);       // card awaiting a unit / lane target
  const [hoverCard, setHoverCard] = useState(null);
  const [inspect, setInspect] = useState(null);           // { id, el } unit detail panel
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const replay = useBattleReplay(battle);
  const { overrides, fx, laneFx, animating } = replay;
  useEffect(() => { onAnimatingChange?.(animating); }, [animating, onAnimatingChange]);

  // While replaying, vitals come from the event stream so bars drop hit by hit.
  const units = (battle?.units || []).map((u) => (overrides[u.id] ? { ...u, ...overrides[u.id] } : u));
  const pendingActor = units.find((u) => u.id === battle?.current_actor_id) || null;
  const actor = animating ? null : pendingActor;  // orders open once the replay has caught up
  const [tickNonce, setTickNonce] = useState(0);
  const livingHeroes = run.heroes.filter((h) => h.is_alive);

  // Default deployment: first three living heroes into lanes 0..2
  useEffect(() => {
    if (!deploying) return;
    const initial = {};
    livingHeroes.slice(0, 3).forEach((h, i) => { initial[h.id] = i; });
    setPlacement(initial);
    setSelectedHero(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploying, battle?.id]);

  useEffect(() => { setTargeting(null); }, [battle?.current_actor_id]);

  const call = useCallback(async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      if (updated) onRunUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setTickNonce((n) => n + 1);
    }
  }, [onRunUpdated]);

  // Drive the battle one action at a time: wait for the replay, pause briefly, tick again.
  // When a hero awaits orders, only tick if the decision window expires.
  useEffect(() => {
    if (!live || animating) return undefined;
    if (pendingActor) {
      const id = setInterval(() => {
        if (Date.now() / 1000 - battle.turn_started_at > battle.turn_time_limit_seconds) call(() => api.tickRun());
      }, EXPIRY_POLL_MS);
      return () => clearInterval(id);
    }
    const t = setTimeout(() => call(() => api.tickRun()), STEP_PAUSE_MS);
    return () => clearTimeout(t);
  }, [live, animating, pendingActor?.id, battle?.event_seq, battle?.turn_started_at, battle?.turn_time_limit_seconds, tickNonce, call]); // eslint-disable-line react-hooks/exhaustive-deps

  const fire = useCallback((card, { lane = null, unitId = null } = {}) => {
    setTargeting(null);
    call(() => api.playAbility(card.id, lane, unitId));
  }, [call]);

  // First click on a targetable ability arms it; clicking it again fires with auto-targeting.
  const play = useCallback((card) => {
    if (!actor || busyRef.current) return;
    if (needsTarget(card) && targeting?.id !== card.id) {
      setTargeting(card);
      return;
    }
    fire(card);
  }, [actor, targeting, fire]);

  const fireAtLane = (lane) => {
    if (targeting?.lane_scope === 'any_lane') fire(targeting, { lane });
  };

  const isValidTarget = (unit) => {
    if (!targeting || !actor || !unit.is_alive || unit.lane === null || unit.lane === undefined) return false;
    const side = targetSide(targeting);
    if (!side) return false;
    const wanted = side === 'ALLY' ? actor.side : actor.side === 'ALLY' ? 'ENEMY' : 'ALLY';
    return unit.side === wanted && lanesInReach(targeting.lane_scope, actor.lane).includes(unit.lane);
  };

  // Hotkeys: 1-5 abilities, Esc cancels targeting, 1-3 pick a lane while targeting
  useEffect(() => {
    const onKey = (e) => {
      if (!live || !actor) return;
      if (e.key === 'Escape') { setTargeting(null); return; }
      if (e.key === 'Enter' && targeting) { e.preventDefault(); fire(targeting); return; }
      const n = parseInt(e.key, 10);
      if (Number.isNaN(n)) return;
      if (targeting?.lane_scope === 'any_lane' && n >= 1 && n <= 3) {
        fireAtLane(n - 1);
        return;
      }
      const card = actor.cards?.[n - 1];
      if (card && card.cooldown_remaining === 0) play(card);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const reach = useMemo(() => {
    const card = targeting || hoverCard;
    if (!card || !actor) return null;
    return new Set(lanesInReach(card.lane_scope, actor.lane));
  }, [targeting, hoverCard, actor]);

  // Deployment helpers
  const placeHero = (lane) => {
    if (!selectedHero) return;
    setPlacement((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((hid) => { if (next[hid] === lane) delete next[hid]; });
      next[selectedHero] = lane;
      return next;
    });
    setSelectedHero(null);
  };
  const unplace = (heroId) => setPlacement((prev) => { const n = { ...prev }; delete n[heroId]; return n; });
  const engage = () => call(() => api.deployHeroes(placement));

  // Click on a unit opens its detail panel — unless the click is meant for the lane (targeting / deploying).
  const onInspect = (unit, el) => {
    if (targeting) {
      if (isValidTarget(unit)) {
        fire(targeting, { unitId: unit.id });
        return true;
      }
      // Not a valid unit: let ANY_LANE abilities fall through to the lane click.
      return targeting.lane_scope !== 'any_lane';
    }
    if (deploying && selectedHero) return false;
    setInspect({ id: unit.id, el });
    return true;
  };

  // Visual state for a unit while an ability is armed.
  const aim = (unit) => {
    if (!targeting) return {};
    const valid = isValidTarget(unit);
    return { targetable: valid ? (unit.side === 'ENEMY' ? 'enemy' : 'ally') : null, dimmed: !valid };
  };

  if (!battle) return null;

  const allKnownUnits = [...units, ...run.heroes, ...run.troops];
  const inspected = inspect ? allKnownUnits.find((u) => u.id === inspect.id) : null;
  const inspectedOwner = inspected?.owner_id ? allKnownUnits.find((u) => u.id === inspected.owner_id)?.name : null;

  const laneData = [0, 1, 2].map((lane) => {
    const meta = battle.lanes[lane];
    const enemies = units.filter((u) => u.side === 'ENEMY' && u.lane === lane);
    let allies = units.filter((u) => u.side === 'ALLY' && u.lane === lane);
    if (deploying) {
      const heroId = Object.keys(placement).find((hid) => placement[hid] === lane);
      const hero = run.heroes.find((h) => h.id === heroId);
      allies = hero ? [hero, ...run.troops.filter((t) => t.owner_id === hero.id && t.is_alive)] : [];
    }
    const defend = battle.objectives.find((o) => o.type === 'DEFEND_LANE' && o.params.lane === lane);
    return { lane, meta, enemies, allies, defend };
  });

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full min-h-0">
      {/* ── LANES + COMMAND BAR ── */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
        <div className="lg:hidden shrink-0">
          <ObjectiveTracker objectives={battle.objectives} compact />
        </div>
        <div className="grid grid-cols-3 grid-rows-1 gap-2 flex-1 min-h-0">
          {laneData.map(({ lane, meta, enemies, allies, defend }) => {
            const enemyHero = enemies.find((u) => u.kind === 'HERO');
            const enemyTroops = enemies.filter((u) => u.kind === 'TROOP' && u.is_alive);
            const allyHero = allies.find((u) => u.kind === 'HERO');
            const allyTroops = allies.filter((u) => u.kind === 'TROOP' && u.is_alive);
            const inReach = reach?.has(lane);
            const laneTargeting = targeting?.lane_scope === 'any_lane' && inReach;
            const pickable = laneTargeting || (deploying && selectedHero);
            const activeLane = actor && actor.lane === lane;
            const enemyLeaderless = !enemyHero?.is_alive && enemyTroops.some((t) => t.is_alive);
            const allyLeaderless = !deploying && !allyHero?.is_alive && allyTroops.some((t) => t.is_alive);

            return (
              <div
                key={`${lane}-${laneFx[lane] || 0}`}
                role={pickable ? 'button' : undefined}
                onClick={() => (laneTargeting ? fireAtLane(lane) : deploying && selectedHero ? placeHero(lane) : null)}
                className={`relative flex flex-col rounded-xl border overflow-hidden min-h-0 transition-all ${
                  meta.cleared
                    ? 'border-emerald-500/50 bg-emerald-950/10'
                    : activeLane
                    ? 'border-cyan-400/70 bg-[#06101f]'
                    : 'border-slate-800 bg-[#060a14]/90'
                } ${inReach ? 'ring-2 ring-cyan-400/70' : ''} ${pickable ? 'cursor-pointer hover:ring-cyan-300' : ''} ${laneFx[lane] ? 'fx-lane-alert' : ''}`}
              >
                {/* Lane header */}
                <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-black/50">
                  <span className="font-orbitron font-bold text-sm tracking-wider text-slate-200">
                    {LANE_NAMES[lane]}
                    {laneTargeting && <span className="ml-1 text-cyan-300">[{lane + 1}]</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    {defend && (
                      <span className={`font-mono text-[11px] px-1.5 rounded border ${defend.status === 'FAILED' ? 'border-red-500 text-red-300' : 'border-amber-500/60 text-amber-300'}`}>
                        HOLD
                      </span>
                    )}
                    {meta.cleared && (
                      <span className="flex items-center gap-1 font-mono text-[11px] px-1.5 rounded border border-emerald-500/60 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> CLEARED
                      </span>
                    )}
                  </div>
                </div>

                {/* Enemy zone */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5 bg-gradient-to-b from-red-950/25 to-transparent">
                  {meta.incoming_waves.map((w, i) => (
                    <div key={i} className="shrink-0 flex items-center gap-1.5 font-mono text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-1.5 py-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Wave @ turn {w.turn}: {w.unit_names.join(', ')}
                    </div>
                  ))}
                  {enemyHero && <div className="pb-1"><HeroTile unit={enemyHero} onInspect={onInspect} fx={fx[enemyHero.id]} {...aim(enemyHero)} /></div>}
                  {enemyLeaderless && <DrillMeter value={meta.enemy_drill_meter} enemy />}
                  {enemyTroops.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      {enemyTroops.map((u) => <TroopTile key={u.id} unit={u} onInspect={onInspect} fx={fx[u.id]} {...aim(u)} />)}
                    </div>
                  )}
                  {enemies.length === 0 && !meta.incoming_waves.length && (
                    <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-600">NO HOSTILES</div>
                  )}
                </div>

                {/* Front line */}
                <div className="shrink-0 relative h-6 flex items-center justify-center">
                  <div className="absolute inset-x-2 top-1/2 border-t border-dashed border-slate-600/70" />
                  <span className="relative font-mono text-[10px] px-2 bg-[#060a14] text-slate-500 tracking-widest">FRONT</span>
                </div>

                {/* Ally zone */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5 bg-gradient-to-t from-cyan-950/25 to-transparent">
                  {allyTroops.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 pb-1">
                      {allyTroops.map((u) => <TroopTile key={u.id} unit={u} onInspect={onInspect} fx={fx[u.id]} {...aim(u)} />)}
                    </div>
                  )}
                  {allyLeaderless && <DrillMeter value={meta.ally_drill_meter} />}
                  {allyHero && (
                    <div className="relative mx-auto w-fit pt-1">
                      <HeroTile unit={allyHero} isActive={actor?.id === allyHero.id} onInspect={onInspect} fx={fx[allyHero.id]} {...aim(allyHero)} />
                      {deploying && (
                        <button
                          onClick={(e) => { e.stopPropagation(); unplace(allyHero.id); }}
                          className="absolute -top-1 -right-3 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-500 flex items-center justify-center hover:bg-red-900"
                          title="Pull back to reserve"
                        >
                          <X className="w-3.5 h-3.5 text-slate-200" />
                        </button>
                      )}
                    </div>
                  )}
                  {allies.length === 0 && (
                    <div className={`flex-1 flex items-center justify-center font-mono text-xs text-center ${deploying && selectedHero ? 'text-cyan-300 animate-pulse' : 'text-slate-600'}`}>
                      {deploying ? (selectedHero ? 'CLICK TO DEPLOY HERE' : 'EMPTY LANE') : 'NO FRIENDLIES'}
                    </div>
                  )}
                </div>

                {laneTargeting && (
                  <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── COMMAND BAR ── */}
        <div className="shrink-0 h-[27%] min-h-[150px] max-h-[320px] hud-panel rounded-xl border-2 border-cyan-500/40 p-2 flex flex-col min-w-0">
          {deploying ? (
            <div className="flex-1 min-h-0 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 flex flex-wrap content-center gap-2 overflow-y-auto">
                {livingHeroes.map((h) => {
                  const tone = factionTone(h.faction);
                  const lane = placement[h.id];
                  const packs = run.troops.filter((t) => t.owner_id === h.id && t.is_alive);
                  const portrait = getPortrait(h.name);
                  return (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHero(selectedHero === h.id ? null : h.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition ${
                        selectedHero === h.id ? 'border-cyan-300 ring-2 ring-cyan-400 bg-cyan-950/50' : `${tone.border} bg-black/50 hover:bg-slate-900`
                      }`}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                        {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover object-top" /> : <Users className={`w-6 h-6 ${tone.text}`} />}
                      </div>
                      <div>
                        <div className="font-orbitron font-bold text-sm text-slate-100">{h.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {h.hp}/{h.max_hp} HP · {packs.length} pack{packs.length === 1 ? '' : 's'} ·{' '}
                          <span className={lane === undefined ? 'text-slate-500' : 'text-cyan-300'}>
                            {lane === undefined ? 'RESERVE' : LANE_NAMES[lane]}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {laneData.some((l) => l.defend && l.allies.length === 0) && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-amber-300 sm:max-w-[200px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  A HOLD lane is empty — the objective fails on engage.
                </span>
              )}
              <button
                disabled={busy || Object.keys(placement).length === 0}
                onClick={engage}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-orbitron font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Rocket className="w-5 h-5" /> Engage
              </button>
            </div>
          ) : actor ? (
            <div className="flex-1 min-h-0 flex gap-3">
              {/* Acting hero */}
              <div className="w-64 xl:w-80 shrink-0 flex items-center gap-3 min-h-0">
                <div className={`w-24 h-24 xl:w-28 xl:h-28 rounded-lg overflow-hidden border-2 bg-black shrink-0 ${factionTone(actor.faction).border}`}>
                  {getPortrait(actor.name)
                    ? <img src={getPortrait(actor.name)} alt="" className="w-full h-full object-cover object-top" />
                    : <Users className={`w-1/2 h-1/2 m-[25%] ${factionTone(actor.faction).text}`} />}
                </div>
                <div className="flex-1 min-w-[120px] flex flex-col justify-center gap-2">
                  <div>
                    <div className="font-orbitron font-black text-base text-cyan-200 leading-tight truncate">{actor.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{LANE_NAMES[actor.lane]} · HP {actor.hp}/{actor.max_hp}</div>
                    {actor.passive && (
                      <div className="font-mono text-[10px] text-violet-300 truncate" title={actor.passive.description}>
                        ★ {actor.passive.name}{actor.passive_stacks ? ` ×${actor.passive_stacks}` : ''}
                      </div>
                    )}
                    {actor.effects?.length > 0 && <div className="mt-1 flex"><EffectBadges effects={actor.effects} /></div>}
                  </div>
                  <TimerBar
                    startedAt={battle.turn_started_at}
                    durationSeconds={battle.turn_time_limit_seconds}
                    onTimeout={() => {}}
                    compact
                  />
                </div>
              </div>

              {/* Abilities */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5 min-h-0">
                <div className={`shrink-0 flex items-center justify-between gap-2 rounded-md px-2 py-1 font-mono text-[11px] ${
                  targeting ? 'bg-cyan-950/60 border border-cyan-400/60 text-cyan-100' : 'text-slate-500'
                }`}>
                  {targeting ? (
                    <>
                      <span className="flex items-center gap-1.5 truncate">
                        <Crosshair className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <b className="font-orbitron">{targeting.name}</b>:&nbsp;
                        {targetSide(targeting)
                          ? `click ${targetSide(targeting) === 'ALLY' ? 'an ally' : 'an enemy'}${targeting.lane_scope === 'any_lane' ? ' or a lane [1-3]' : ''}`
                          : 'click a lane [1-3]'}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <button onClick={() => fire(targeting)} className="px-2 py-0.5 rounded bg-cyan-500 text-black font-bold hover:bg-cyan-400">AUTO [ENTER]</button>
                        <button onClick={() => setTargeting(null)} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">CANCEL [ESC]</button>
                      </span>
                    </>
                  ) : hoverCard ? (
                    <span className="flex items-center gap-2 min-w-0 text-slate-300">
                      <b className="font-orbitron text-slate-100 shrink-0">{hoverCard.name}</b>
                      <span className="truncate">{hoverCard.description}</span>
                      <span className="shrink-0"><EffectSpecChips effects={hoverCard.effects} /></span>
                    </span>
                  ) : (
                    <span>Choose an ability · targeted abilities: pick a unit, or click the ability again to auto-target</span>
                  )}
                </div>
                <div className="flex-1 min-h-0 flex items-center gap-2 overflow-x-auto">
                  {actor.cards.map((card, i) => (
                    <AbilityCard
                      key={card.id}
                      card={card}
                      index={i}
                      disabled={busy}
                      selected={targeting?.id === card.id}
                      onPlay={play}
                      onHover={setHoverCard}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 font-mono text-sm text-slate-500">
              <Hourglass className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
              {animating ? 'COMBAT IN PROGRESS…' : live ? 'INITIATIVE RUNNING — hostiles and drills acting…' : 'Battle resolved.'}
            </div>
          )}
          {error && <div className="mt-1 font-mono text-[10px] text-red-400">{error}</div>}
        </div>
      </div>

      {/* ── SIDEBAR: OBJECTIVES + LOG ── */}
      <div className="hidden lg:flex lg:w-60 shrink-0 flex-col gap-2 min-h-0">
        <div className="hud-panel rounded-xl p-2 border border-cyan-500/20">
          <div className="flex items-center justify-between font-mono text-[9px] text-slate-400 mb-1.5">
            <span>OBJECTIVES</span>
            <span>TURN {battle.turn}</span>
          </div>
          <ObjectiveTracker objectives={battle.objectives} />
        </div>
        <div className="hud-panel rounded-xl p-2 border border-slate-800 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="font-mono text-[8px] text-slate-500 mb-1">BATTLE LOG</div>
          <div className="flex-1 overflow-y-auto flex flex-col-reverse gap-0.5">
            {[...battle.log].reverse().slice(0, 30).map((line, i) => (
              <div
                key={battle.log.length - i}
                className={`font-mono text-[9px] leading-snug ${
                  i === 0 ? 'text-slate-100' : i < 4 ? 'text-slate-300' : 'text-slate-500'
                } ${line.includes('💀') ? '!text-red-400' : ''} ${line.includes('🚨') ? '!text-amber-300' : ''} ${line.includes('🏆') ? '!text-emerald-300' : ''}`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
      <BattleFxLayer tracers={replay.tracers} floaters={replay.floaters} />
      {inspected && inspect.el?.isConnected && (
        <UnitInfoPopover
          unit={inspected}
          anchorEl={inspect.el}
          ownerName={inspectedOwner}
          onClose={() => setInspect(null)}
        />
      )}
    </div>
  );
}
