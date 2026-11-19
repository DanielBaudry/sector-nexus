import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Crosshair, Rocket, Radio, Users, X, Target, ScrollText, Map as MapIcon, Package, Crown, Gem } from 'lucide-react';
import { api } from '../../services/api';
import { SKILL_IMAGES } from '../CardChoice';
import { EFFECT_META, EffectBadges } from './StatusEffects';
import { HeroTile, TroopTile } from './LaneUnits';
import ObjectiveTracker from './ObjectiveTracker';
import UnitInfoPopover from './UnitInfoPopover';
import BattleFxLayer from './BattleFxLayer';
import BossBanner from './BossBanner';
import useBattleReplay from './useBattleReplay';
import { IdleNotice, PressureVignette, RailButton, SideDrawer, TurnBanner, TurnClock, urgencyOf, useCountdown } from './BattleHud';
import { ArtifactDetail, LogFeed, LootSummary, RouteMap } from './BattleDrawers';
import { ManaOrb, ReserveModal } from './ManaReserve';
import { LANE_NAMES, SCOPE_LABEL, factionTone, getPortrait, lanesInReach } from '../../utils/battleVisuals';

const STEP_PAUSE_MS = 250;   // breather between resolved actions (animations add the rest)
const EXPIRY_POLL_MS = 500;
const TIMED_TURNS = false;   // decision timer disabled for now (no countdown, no auto-play on expiry)

function DrillMeter({ value, enemy }) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 font-mono text-[12px] text-slate-400 px-1" title="Leaderless troops fire on their own (slower) drill meter">
      <Radio className="w-3.5 h-3.5" /> DRILL
      <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
        <div className={`h-full ${enemy ? 'bg-red-500/70' : 'bg-cyan-500/70'}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

// Lane mood: who holds the lane, from the remaining HP on each side (a colossal boss weighs on every lane).
const MOODS = {
  neutral:   { label: 'FRONT',     line: '#334155', glow: '#33415588', text: '#94a3b8', ground: 'transparent' },
  secured:   { label: 'SECURED',   line: '#10b981', glow: '#10b98166', text: '#6ee7b7', ground: 'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(16,185,129,0.10), transparent 70%)' },
  advantage: { label: 'ADVANTAGE', line: '#22d3ee', glow: '#22d3ee77', text: '#67e8f9', ground: 'linear-gradient(to top, rgba(34,211,238,0.14), transparent 65%)' },
  contested: { label: 'CONTESTED', line: '#f59e0b', glow: '#f59e0b77', text: '#fcd34d', ground: 'radial-gradient(ellipse 90% 30% at 50% 50%, rgba(245,158,11,0.12), transparent 75%)' },
  overrun:   { label: 'OVERRUN',   line: '#ef4444', glow: '#ef444488', text: '#fca5a5', ground: 'linear-gradient(to bottom, rgba(239,68,68,0.20), rgba(239,68,68,0.05) 70%, transparent)' },
};

function laneMood(meta, enemies, allies, boss) {
  if (meta.cleared) return 'secured';
  const hp = (list) => list.filter((u) => u.is_alive).reduce((sum, u) => sum + (u.hp || 0), 0);
  const ally = hp(allies);
  const enemy = hp(enemies) + (boss?.is_alive ? boss.hp / 3 : 0);
  if (!enemy) return ally ? 'advantage' : 'neutral';
  if (!ally) return 'overrun';
  const share = ally / (ally + enemy);
  return share >= 0.62 ? 'advantage' : share <= 0.38 ? 'overrun' : 'contested';
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

const TARGET_LABEL = {
  single_enemy: 'Single enemy',
  all_enemies: 'All enemies in reach',
  self: 'Self',
  all_allies: 'All allies in reach',
  lowest_hp_ally: 'Weakest ally',
};
const EFFECT_TARGET_LABEL = { self: 'Self', ally: 'One ally', allies: 'Allies', hit: 'Targets hit', enemies: 'Enemies' };

/** Big hover card for an ability: what it does, its reach, and each buff / debuff it applies. */
function AbilityTooltip({ card, index, rect }) {
  const W = 400;
  const left = Math.max(12, Math.min(window.innerWidth - W - 12, rect.left + rect.width / 2 - W / 2));
  const bottom = window.innerHeight - rect.top + 14;
  const img = SKILL_IMAGES[card.name];
  const stats = [
    card.power_multiplier > 0 && { label: 'Damage', value: `${Math.round(card.power_multiplier * 100)}% ATK`, color: 'text-red-300' },
    card.heal_multiplier > 0 && { label: 'Heal', value: `${Math.round(card.heal_multiplier * 100)}% ATK`, color: 'text-emerald-300' },
    card.shield_grant > 0 && { label: 'Shield', value: `+${card.shield_grant}`, color: 'text-cyan-300' },
    card.summon_troop_id && { label: 'Summon', value: 'Troop pack', color: 'text-emerald-300' },
    card.mana_gain > 0 && { label: 'Mana', value: `+${card.mana_gain}`, color: 'text-violet-300' },
  ].filter(Boolean);
  return createPortal(
    <div className="fixed z-[80] pointer-events-none panel-enter" style={{ left, bottom, width: W }}>
      <div className="rounded-2xl border-2 border-cyan-400/60 backdrop-blur-md shadow-[0_0_40px_rgba(34,211,238,0.25),0_20px_50px_rgba(0,0,0,0.7)] p-4" style={{ background: 'rgba(6, 12, 26, 0.97)' }}>
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 shrink-0 rounded-xl bg-black/70 border border-white/10 flex items-center justify-center overflow-hidden">
            {img ? <img src={img} alt="" className="w-full h-full object-contain p-1" /> : <Crosshair className="w-7 h-7 text-cyan-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-orbitron font-black text-xl text-white leading-tight">{card.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[12px]">
              <span className="px-1.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-200">{SCOPE_LABEL[card.lane_scope] || 'LANE'}</span>
              <span className="px-1.5 rounded bg-slate-900 border border-slate-600 text-slate-200">{TARGET_LABEL[card.target_type] || card.target_type}</span>
              {card.cooldown_turns > 0 && (
                <span className={`px-1.5 rounded border ${card.cooldown_remaining > 0 ? 'bg-red-950/70 border-red-500/60 text-red-200' : 'bg-slate-900 border-slate-600 text-slate-300'}`}>
                  {card.cooldown_remaining > 0 ? `READY IN ${card.cooldown_remaining}` : `COOLDOWN ${card.cooldown_turns}`}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[12px] px-1.5 rounded bg-black/70 border border-slate-600 text-slate-300">[{index + 1}]</span>
        </div>

        <p className="mt-3 text-[16px] leading-relaxed text-slate-100">{card.description}</p>

        {stats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.map((st) => (
              <span key={st.label} className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 font-mono text-[13px]">
                <span className="text-slate-400">{st.label} </span><b className={st.color}>{st.value}</b>
              </span>
            ))}
          </div>
        )}

        {card.effects?.length > 0 && (
          <div className="mt-3 space-y-2">
            {card.effects.map((e, i) => {
              const meta = EFFECT_META[e.type];
              const Icon = meta?.icon || Crosshair;
              const color = meta?.color || '#94a3b8';
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl border bg-black/40 px-3 py-2" style={{ borderColor: `${color}66` }}>
                  <span className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center bg-black/80 border-2" style={{ borderColor: color, boxShadow: `0 0 10px ${color}55` }}>
                    <Icon className="w-6 h-6" style={{ color }} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-orbitron font-bold text-[15px]" style={{ color }}>{e.label}</span>
                      <span className={`font-mono text-[11px] px-1 rounded ${e.is_buff ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>{e.is_buff ? 'BUFF' : 'DEBUFF'}</span>
                    </div>
                    <div className="text-[14px] text-slate-200 leading-snug">{e.description}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[12px] text-slate-400">
                      {e.target && <span>→ {EFFECT_TARGET_LABEL[e.target] || e.target}</span>}
                      {e.turns > 0 && <span>{e.turns} turn{e.turns > 1 ? 's' : ''}</span>}
                      {e.chance < 1 && <span>{Math.round(e.chance * 100)}% chance</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function AbilityCard({ card, index, disabled, selected, onPlay, onHover }) {
  const [rect, setRect] = useState(null);
  const enter = (e) => { setRect(e.currentTarget.getBoundingClientRect()); onHover(card); };
  const leave = () => { setRect(null); onHover(null); };
  const onCooldown = card.cooldown_remaining > 0;
  const img = SKILL_IMAGES[card.name];
  const isSummon = !!card.summon_troop_id;
  return (
    <button
      aria-disabled={disabled || onCooldown}
      onClick={() => { if (!disabled && !onCooldown) onPlay(card); }}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      className={`relative shrink-0 h-full max-h-[150px] w-[124px] rounded-xl border-2 text-left overflow-hidden flex flex-col transition-all ${
        onCooldown
          ? 'border-slate-800 bg-slate-950 opacity-50 cursor-not-allowed'
          : selected
          ? 'border-cyan-200 ring-2 ring-cyan-300 bg-cyan-950/60 -translate-y-1'
          : isSummon
          ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 to-black hover:border-emerald-300 hover:-translate-y-2 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]'
          : 'border-cyan-500/50 bg-gradient-to-b from-[#071a33] to-black hover:border-cyan-300 hover:-translate-y-2 hover:shadow-[0_8px_24px_rgba(34,211,238,0.35)]'
      } disabled:hover:translate-y-0`}
    >
      <div className="relative flex-1 min-h-0 bg-black/60 flex items-center justify-center overflow-hidden">
        {img ? <img src={img} alt="" className="h-full w-full object-contain p-1" /> : isSummon ? <Users className="w-1/3 h-1/3 text-emerald-300" /> : <Crosshair className="w-1/3 h-1/3 text-cyan-300" />}
        <span className="absolute top-0.5 left-0.5 font-mono text-[11px] px-1 rounded bg-black/80 border border-slate-600 text-slate-300">{index + 1}</span>
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
        <div className="font-orbitron font-bold text-[12px] leading-tight text-slate-100 truncate">{card.name}</div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="font-mono text-[10px] px-1 rounded bg-black/60 border border-cyan-600/60 text-cyan-300 truncate">
            {SCOPE_LABEL[card.lane_scope] || 'LANE'}
          </span>
          {card.mana_gain > 0 && (
            <span className="flex items-center gap-0.5 font-orbitron font-bold text-[10px] px-1 rounded bg-violet-950 border border-violet-400/70 text-violet-200 shrink-0" title={`+${card.mana_gain} mana`}>
              +{card.mana_gain}<Gem className="w-2.5 h-2.5" />
            </span>
          )}
          {card.cooldown_turns > 0 && <span className="font-mono text-[10px] text-slate-500 shrink-0">CD{card.cooldown_turns}</span>}
        </div>
      </div>
      {rect && <AbilityTooltip card={card} index={index} rect={rect} />}
      {onCooldown && (
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 font-orbitron font-black text-slate-200">
          <span className="text-2xl">{card.cooldown_remaining}</span>
          <span className="font-mono text-[11px] text-slate-400">TURNS</span>
        </span>
      )}
    </button>
  );
}

export default function LaneBattleBoard({ run, planet, onRunUpdated, onAnimatingChange, onExtract, canExtract = true }) {
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
  const [drawer, setDrawer] = useState(null);             // 'objectives' | 'log' | 'route' | 'loot'
  const [banner, setBanner] = useState(null);             // "YOUR TURN" swoosh
  const [reserveOpen, setReserveOpen] = useState(false);  // troop reserve / mana modal
  const [artifactDetail, setArtifactDetail] = useState(null);
  const toggleDrawer = (id) => setDrawer((d) => (d === id ? null : id));

  const replay = useBattleReplay(battle);
  const { overrides, fx, laneFx, animating, announce, acting, settled, manaPulse } = replay;
  useEffect(() => { onAnimatingChange?.(animating); }, [animating, onAnimatingChange]);

  // While replaying, vitals come from the event stream so bars drop hit by hit.
  // When a battle ends the server pulls the squad off the field for the next node (lane cleared,
  // so the final state no longer lists them). Remember everyone as they stood during the fight and
  // keep the survivors on the field — with their final vitals — until the result screen.
  const fieldRef = useRef({ battleId: null, units: {} });
  if (battle && fieldRef.current.battleId !== battle.id) fieldRef.current = { battleId: battle.id, units: {} };
  const finished = battle && ['WON', 'LOST'].includes(battle.status);
  if (battle && !finished) battle.units.forEach((u) => { fieldRef.current.units[u.id] = u; });
  let fieldUnits = battle?.units || [];
  if (finished) {
    const present = new Set(fieldUnits.map((u) => u.id));
    const roster = Object.fromEntries([...run.heroes, ...run.troops].map((u) => [u.id, u]));
    const withdrawn = Object.values(fieldRef.current.units)
      .filter((u) => !present.has(u.id) && u.side === 'ALLY')
      .map((u) => {
        const now = roster[u.id];
        return now ? { ...u, hp: now.hp, shields: now.shields, count: now.count, is_alive: now.is_alive } : u;
      });
    fieldUnits = [...fieldUnits, ...withdrawn];
  }
  const units = fieldUnits.map((u) => (overrides[u.id] ? { ...u, ...overrides[u.id] } : u));
  const pendingActor = units.find((u) => u.id === battle?.current_actor_id) || null;
  const actor = settled ? pendingActor : null;  // orders open once the replay has fully caught up
  const [tickNonce, setTickNonce] = useState(0);
  const livingHeroes = run.heroes.filter((h) => h.is_alive);

  // Decision clock + pressure.
  const deciding = live && !!actor;
  const timeLeft = useCountdown(battle?.turn_started_at || 0, battle?.turn_time_limit_seconds || 1, deciding && TIMED_TURNS);
  const urgency = deciding && TIMED_TURNS ? urgencyOf(timeLeft, battle.turn_time_limit_seconds) : 0;
  const lowHp = live && units.some((u) => u.side === 'ALLY' && u.kind === 'HERO' && u.is_alive && u.hp / u.max_hp < 0.3);

  // "YOUR TURN" swoosh whenever a hero becomes ready for orders.
  // Shown a beat after the last animation settles, so it never overlaps the previous action.
  const bannerFor = useRef(null);
  const bannerTimers = useRef([]);
  const clearBanner = () => { bannerTimers.current.forEach(clearTimeout); bannerTimers.current = []; setBanner(null); };
  useEffect(() => {
    if (!deciding || actor.side !== 'ALLY') return;
    // Once per hero turn: a mid-turn refresh (e.g. deploying a troop) must not replay it.
    const turnKey = `${actor.id}:${battle.turn_started_at}`;
    if (bannerFor.current === turnKey) return;
    bannerFor.current = turnKey;
    clearBanner();
    bannerTimers.current = [
      setTimeout(() => setBanner({ key: `${actor.id}-${battle.event_seq}`, name: actor.name }), 220),
      setTimeout(() => setBanner(null), 220 + 1200),
    ];
  }, [deciding, actor?.id, battle?.turn_started_at]); // eslint-disable-line react-hooks/exhaustive-deps
  // Orders given (the turn resolves) or battle over: drop a pending swoosh.
  useEffect(() => { if (!pendingActor || !live) clearBanner(); }, [pendingActor?.id, live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => bannerTimers.current.forEach(clearTimeout), []);

  // Esc closes an open drawer (when no ability is being aimed).
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !targeting) setDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, targeting]);

  // M toggles the troop reserve.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') setReserveOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      if (!TIMED_TURNS) return undefined;  // wait for the player's orders, however long
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
    return unit.side === wanted && (unit.spans_lanes || lanesInReach(targeting.lane_scope, actor.lane).includes(unit.lane));
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

  // Troop reserve: spend mana to drop a pack into a lane (free action on the player's turn).
  const reserve = run.troops.filter((t) => t.is_alive && t.deployed_lane == null);
  const onField = run.troops.filter((t) => t.is_alive && t.deployed_lane != null);
  // Before Engage, show what the battle will open with (the mana floor applies on engage).
  const mana = deploying ? Math.max(run.mana ?? 0, run.mana_floor ?? 0) : replay.mana ?? run.mana ?? 0;
  const manaCap = run.mana_cap ?? 10;
  const canDeployTroops = live && !!actor && actor.side === 'ALLY' && !busy;
  const deployBlockedReason = deploying
    ? 'Engage first — reserve troops are deployed during your turns.'
    : !live ? 'The battle is over.'
    : 'Wait for your turn — troops deploy while a hero awaits orders.';
  const deployTroop = (pack, lane) => {
    setReserveOpen(false);
    call(() => api.deployTroop(pack.id, lane));
  };

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

  // A colossal boss spans every lane: drawn once above the lanes, not inside them.
  const boss = units.find((u) => u.spans_lanes);
  const intentLanes = new Set(boss?.is_alive && boss.intent ? boss.intent.lanes : []);

  const laneData = [0, 1, 2].map((lane) => {
    const meta = battle.lanes[lane];
    const enemies = units.filter((u) => u.side === 'ENEMY' && u.lane === lane && !u.spans_lanes);
    let allies = units.filter((u) => u.side === 'ALLY' && u.lane === lane);
    if (deploying) {
      const heroId = Object.keys(placement).find((hid) => placement[hid] === lane);
      const hero = run.heroes.find((h) => h.id === heroId);
      allies = [...(hero ? [hero] : []), ...run.troops.filter((t) => t.deployed_lane === lane && t.is_alive)];
    }
    const defend = battle.objectives.find((o) => o.type === 'DEFEND_LANE' && o.params.lane === lane);
    return { lane, meta, enemies, allies, defend };
  });

  const battleArt = planet?.battle_image || null;
  const clockMode = deploying ? 'deploy' : deciding ? 'decide' : live ? 'resolve' : 'over';
  const primaryObjectives = battle.objectives;
  const depth = run.nodes.find((n) => n.id === run.current_node_id)?.row ?? 0;
  const maxDepth = Math.max(...run.nodes.map((n) => n.row));

  return (
    <div className="relative h-full min-h-0 flex flex-col">
      {/* Planet battlefield art behind everything (-z-10: under the non-positioned UI), darkened for readability */}
      {battleArt && (
        <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${battleArt})` }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(3,5,12,0.88) 0%, rgba(3,5,12,0.5) 14%, rgba(3,5,12,0.42) 50%, rgba(3,5,12,0.55) 76%, rgba(3,5,12,0.9) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
        </div>
      )}
      {/* ── TOP: where we are · decision clock · turn ── */}
      <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-3 pt-2">
        <div className="min-w-0 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-orbitron font-bold text-[13px] tracking-wider text-slate-200 truncate">{run.biome_name.toUpperCase()}</span>
          {run.mode === 'boss' ? (
            <span className="px-1.5 rounded bg-orange-950/70 text-orange-300 border border-orange-500/50 font-mono text-[12px] flex items-center gap-1"><Crown className="w-3 h-3" /> BOSS</span>
          ) : (
            <span className="px-1.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 font-mono text-[12px]">DEPTH {depth}/{maxDepth}</span>
          )}
          {run.difficulty > 1 && <span className="px-1.5 rounded bg-red-950/60 text-red-300 border border-red-500/40 font-mono text-[12px]">DIFF {run.difficulty}</span>}
        </div>
        <TurnClock mode={clockMode} actor={actor} acting={acting} left={timeLeft} duration={battle.turn_time_limit_seconds} turn={battle.turn} timed={TIMED_TURNS} />
        <div className="flex justify-end pt-1">
          <div className="text-right">
            <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500">TURN</div>
            <div className="font-orbitron font-black text-3xl leading-none text-slate-100 tabular-nums">{battle.turn}</div>
          </div>
        </div>
      </div>

      {boss && <div className="shrink-0 px-[4.75rem] pt-2"><BossBanner boss={boss} fx={fx[boss.id]} onInspect={onInspect} {...aim(boss)} /></div>}

      {/* ── MIDDLE: rails + battlefield ── */}
      <div className="flex-1 min-h-0 flex gap-2 px-2 py-2">
        {/* Left rail */}
        <div className="shrink-0 w-16 flex flex-col items-center justify-center gap-5">
          <RailButton icon={Target} label="Goals" active={drawer === 'objectives'} onClick={() => toggleDrawer('objectives')}
            badge={`${primaryObjectives.filter((o) => o.status === 'COMPLETE').length}/${primaryObjectives.length}`} />
          <RailButton icon={ScrollText} label="Log" active={drawer === 'log'} onClick={() => toggleDrawer('log')} />
          <div className="h-px w-10 bg-white/10" />
          <RailButton icon={Rocket} label="Extract" tone="red" onClick={onExtract} disabled={!canExtract || busy} />
        </div>

        {/* Battlefield + drawers */}
        <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden rounded-xl">
            {/* One shared battlefield: enemy territory glows red from the top, ours cyan from the bottom */}
            <div className={`relative grid grid-cols-3 grid-rows-1 h-full min-h-0 rounded-xl overflow-hidden border border-white/5 ${battleArt ? 'bg-black/25' : 'bg-[#050913]'}`}>
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_45%_at_50%_0%,rgba(127,29,29,0.28),transparent_70%),radial-gradient(ellipse_90%_45%_at_50%_100%,rgba(8,145,178,0.22),transparent_70%)]" />
              {!battleArt && <div className="absolute inset-0 pointer-events-none opacity-[0.07] bg-[linear-gradient(rgba(148,163,184,1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,1)_1px,transparent_1px)] bg-[size:48px_48px]" />}
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
                const threatened = intentLanes.has(lane);
                const hostileActing = acting?.side === 'ENEMY' && acting.lane === lane;
                const mood = deploying ? 'neutral' : laneMood(meta, enemies, allies, boss);
                const M = MOODS[mood];

                return (
                  <div
                    key={`${lane}-${laneFx[lane] || 0}`}
                    role={pickable ? 'button' : undefined}
                    onClick={() => (laneTargeting ? fireAtLane(lane) : deploying && selectedHero ? placeHero(lane) : null)}
                    className={`relative flex flex-col overflow-hidden min-h-0 transition-all ${
                      inReach ? 'ring-2 ring-inset ring-cyan-400/60' : ''
                    } ${pickable ? 'cursor-pointer hover:ring-cyan-300' : ''} ${laneFx[lane] ? 'fx-lane-alert' : ''} ${
                      threatened ? 'shadow-[inset_0_0_60px_rgba(249,115,22,0.3)]' : ''
                    } ${hostileActing ? 'shadow-[inset_0_0_70px_rgba(239,68,68,0.35)]' : ''}`}
                  >
                    {/* Lane mood: the ground itself tells who is winning here */}
                    <div className="absolute inset-0 pointer-events-none transition-[background] duration-700" style={{ background: M.ground }} />
                    {activeLane && <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-cyan-400/10 via-cyan-400/[0.03] to-transparent" />}
                    {threatened && (
                      <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(135deg,rgba(249,115,22,0.10)_0,rgba(249,115,22,0.10)_12px,transparent_12px,transparent_24px)] animate-pulse" />
                    )}
                    {/* Soft divider instead of a box border */}
                    {lane > 0 && <div className="absolute left-0 inset-y-4 w-px pointer-events-none bg-gradient-to-b from-transparent via-slate-300/20 to-transparent" />}

                    {/* Lane label: painted on the ground */}
                    <div className="relative shrink-0 h-8 flex items-center justify-center gap-2 px-2">
                      <span className="font-mono text-[12px] tracking-[0.35em] text-slate-300 [text-shadow:0_1px_4px_#000,0_0_10px_#000]">
                        {LANE_NAMES[lane]}
                        {laneTargeting && <span className="ml-1 text-cyan-300">[{lane + 1}]</span>}
                      </span>
                      {defend && (
                        <span className={`font-mono text-[12px] px-1.5 rounded border ${defend.status === 'FAILED' ? 'border-red-500 text-red-300' : 'border-amber-500/60 text-amber-300'}`}>HOLD</span>
                      )}
                      {threatened && (
                        <span className="flex items-center gap-1 font-mono text-[12px] px-1.5 rounded border border-orange-400 bg-orange-950/80 text-orange-200 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" /> {boss.intent.name.toUpperCase()} · {boss.intent.turns}T
                        </span>
                      )}
                      {meta.cleared && (
                        <span className="flex items-center gap-1 font-mono text-[12px] px-1.5 rounded border border-emerald-500/60 text-emerald-300 bg-emerald-950/50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CLEARED
                        </span>
                      )}
                    </div>

                    {/* Enemy zone */}
                    <div className="relative flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
                      {meta.incoming_waves.map((w, i) => (
                        <div key={i} className="shrink-0 self-center flex items-center gap-1.5 font-mono text-[13px] text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-full px-2.5 py-0.5">
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
                        <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-600">
                          {boss?.is_alive ? `${boss.name.toUpperCase()} LOOMS OVER THIS LANE` : 'NO HOSTILES'}
                        </div>
                      )}
                    </div>

                    {/* Front line: one continuous line across the field, coloured by who holds each lane */}
                    <div className="relative shrink-0 h-7 flex items-center justify-center">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] transition-colors duration-700" style={{ background: M.line, boxShadow: `0 0 12px 1px ${M.glow}` }} />
                      <span className="relative font-mono text-[11px] font-bold tracking-[0.3em] px-2.5 py-px rounded-full border bg-[#050913]"
                        style={{ color: M.text, borderColor: `${M.glow}` }}>
                        {M.label}
                      </span>
                    </div>

                    {/* Ally zone */}
                    <div className="relative flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
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

          <SideDrawer side="left" open={drawer === 'objectives'} title="OBJECTIVES" icon={Target} onClose={() => setDrawer(null)}>
            <div className="font-mono text-[12px] text-slate-400 mb-2">TURN {battle.turn}</div>
            <ObjectiveTracker objectives={battle.objectives} />
          </SideDrawer>
          <SideDrawer side="left" open={drawer === 'log'} title="BATTLE LOG" icon={ScrollText} onClose={() => setDrawer(null)}>
            <LogFeed log={battle.log} />
          </SideDrawer>
          <SideDrawer side="right" open={drawer === 'route'} title="EXPEDITION ROUTE" icon={MapIcon} onClose={() => setDrawer(null)}>
            <RouteMap run={run} />
          </SideDrawer>
          <SideDrawer side="right" open={drawer === 'loot'} title="LOOT & REWARDS" icon={Package} onClose={() => setDrawer(null)}>
            <LootSummary run={run} onArtifact={setArtifactDetail} />
          </SideDrawer>
        </div>

        {/* Right rail */}
        <div className="shrink-0 w-16 flex flex-col items-center justify-center gap-5">
          <RailButton icon={MapIcon} label="Route" active={drawer === 'route'} onClick={() => toggleDrawer('route')} disabled={run.mode === 'boss'} />
          <RailButton icon={Package} label="Loot" tone="amber" active={drawer === 'loot'} onClick={() => toggleDrawer('loot')}
            badge={run.rewards?.artifacts?.length || null} />
        </div>
      </div>

      {/* ── BOTTOM: centred command console on the screen edge ── */}
      <div className="shrink-0 flex justify-center px-2">
        <div className="w-[min(1120px,calc(100%-280px))] h-[184px] rounded-t-2xl border-t-2 border-x border-cyan-500/40 bg-gradient-to-b from-[#0a1428]/95 to-[#03060e] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] px-3 pt-2 pb-2 flex flex-col min-w-0">
          {deploying ? (
            <div className="flex-1 min-h-0 flex items-center justify-center gap-3">
              <div className="flex flex-wrap content-center justify-center gap-2 overflow-y-auto min-w-0">
                {livingHeroes.map((h) => {
                  const tone = factionTone(h.faction);
                  const lane = placement[h.id];
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
                        <div className="font-mono text-[13px] text-slate-400">
                          {h.hp}/{h.max_hp} HP ·{' '}
                          <span className={lane === undefined ? 'text-slate-500' : 'text-cyan-300'}>
                            {lane === undefined ? 'RESERVE' : LANE_NAMES[lane]}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="shrink-0 flex flex-col items-center gap-2">
                {laneData.some((l) => l.defend && l.allies.length === 0) && (
                  <span className="flex items-center gap-1 font-mono text-[12px] text-amber-300 max-w-[200px]">
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
            </div>
          ) : actor ? (
            <div className="flex-1 min-h-0 flex items-stretch justify-center gap-3">
              {/* Acting hero: big portrait + vitals */}
              <div className={`relative w-[132px] shrink-0 rounded-xl overflow-hidden border-2 bg-black ${factionTone(actor.faction).border} shadow-[0_0_24px_rgba(34,211,238,0.25)]`}>
                {getPortrait(actor.name)
                  ? <img src={getPortrait(actor.name)} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
                  : <Users className={`absolute inset-0 m-auto w-1/2 h-1/2 ${factionTone(actor.faction).text}`} />}
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black via-black/80 to-transparent">
                  <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-white/10">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, (actor.hp / actor.max_hp) * 100))}%` }} />
                  </div>
                  <div className="font-mono text-[11px] text-slate-200 text-center mt-0.5">{actor.hp}/{actor.max_hp}</div>
                </div>
              </div>
              <div className="w-[190px] shrink-0 flex flex-col justify-center gap-1 min-w-0">
                <div className="font-orbitron font-black text-lg text-cyan-200 leading-tight">{actor.name}</div>
                <div className="font-mono text-[13px] text-slate-400">{LANE_NAMES[actor.lane]}</div>
                {actor.passive && (
                  <div className="font-mono text-[12px] text-violet-300 leading-snug" title={actor.passive.description}>
                    ★ {actor.passive.name}{actor.passive_stacks ? ` ×${actor.passive_stacks}` : ''}
                  </div>
                )}
                {actor.effects?.length > 0 && <div className="mt-1.5 flex"><EffectBadges effects={actor.effects} size="lg" /></div>}
              </div>

              {/* Abilities (up to 4), right next to the hero */}
              <div className="w-[540px] max-w-full min-w-0 flex flex-col gap-1.5 min-h-0">
                <div className={`shrink-0 h-7 flex items-center justify-between gap-2 rounded-md px-2 font-mono text-[13px] ${
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
                        <button onClick={() => setTargeting(null)} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">ESC</button>
                      </span>
                    </>
                  ) : (
                    <span className="truncate">Choose an ability · click a targeted one again to auto-aim</span>
                  )}
                </div>
                <div className="flex-1 min-h-0 flex items-center gap-3 overflow-x-auto">
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
            <IdleNotice animating={animating} live={live} acting={acting} />
          )}
          {error && <div className="mt-1 font-mono text-[12px] text-red-400">{error}</div>}
        </div>
      </div>

      {/* Mana reserve, docked bottom-left */}
      <div className="absolute left-5 bottom-4 z-30">
        <ManaOrb mana={mana} cap={manaCap} reserve={reserve} ready={canDeployTroops} pulse={manaPulse}
          open={reserveOpen} onClick={() => setReserveOpen((o) => !o)} />
      </div>
      <ReserveModal
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        mana={mana}
        cap={manaCap}
        reserve={reserve}
        onField={onField}
        canDeploy={canDeployTroops}
        reason={deployBlockedReason}
        laneInfo={laneData.map(({ enemies }) => {
          const foes = enemies.filter((u) => u.is_alive).length + (boss?.is_alive ? 1 : 0);
          return foes ? `${foes} foe${foes > 1 ? 's' : ''}` : 'clear';
        })}
        onDeploy={deployTroop}
        busy={busy}
      />

      <ArtifactDetail artifact={artifactDetail} onClose={() => setArtifactDetail(null)} />
      <PressureVignette urgency={urgency} lowHp={lowHp} />
      <TurnBanner banner={banner} />
      <BattleFxLayer projectiles={replay.projectiles} floaters={replay.floaters} />
      {announce && (
        <div key={announce.key} className="fixed inset-x-0 top-1/3 z-[60] flex justify-center pointer-events-none">
          <div className={`fx-announce px-10 py-4 rounded-2xl border-2 backdrop-blur-sm text-center ${
            announce.tone === 'phase' ? 'border-red-400 bg-red-950/85 shadow-[0_0_60px_rgba(239,68,68,0.5)]' : 'border-orange-400 bg-orange-950/85 shadow-[0_0_60px_rgba(249,115,22,0.5)]'
          }`}>
            <div className="font-mono text-[13px] tracking-[0.3em] text-orange-200">{announce.kicker}</div>
            <div className="font-orbitron font-black text-3xl text-white">{announce.title}</div>
            {announce.subtitle && <div className="font-mono text-sm text-slate-200 mt-1 max-w-xl">{announce.subtitle}</div>}
          </div>
        </div>
      )}
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
