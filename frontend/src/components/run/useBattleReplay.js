import { useCallback, useEffect, useRef, useState } from 'react';
import { projectileStyleFor, slashColorFor } from '../../utils/battleVisuals';

// Pacing (ms). Tuned so one enemy/drill action reads in ~1s without dragging.
const T = {
  turn: 260,
  ability: 380,
  hit: 340,
  volleyHit: 240,
  heal: 340,
  shield: 280,
  summon: 420,
  wave: 650,
  effect: 240,
  dot: 380,
  passive: 320,
  telegraph: 700,
  phase: 1600,
  announce: 1900,
  endGap: 260,
  enemyWindup: 750,   // hostile actor lights up before acting: time to see it coming
  enemyEndGap: 520,   // breather after a hostile action
  floater: 1150,
  mana: 220,
  impact: 380,
};

// Projectile flight: base ms + ms per pixel, capped; arc = control-point lift (share of distance).
const FLIGHT = {
  bullet: { base: 90, perPx: 0.14, max: 230, arc: 0 },
  glob: { base: 190, perPx: 0.2, max: 380, arc: 0.28 },
  psi: { base: 160, perPx: 0.18, max: 320, arc: 0.08 },
  void: { base: 170, perPx: 0.18, max: 330, arc: 0.12 },
  boss: { base: 240, perPx: 0.2, max: 420, arc: 0.22 },
  heal: { base: 210, perPx: 0.15, max: 360, arc: 0.18 },
  slash: { base: 140, perPx: 0, max: 140, arc: 0 },
};

function flightPath(a, b, arc) {
  if (!arc) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - dist * arc;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function snapshot(units = []) {
  const map = {};
  units.forEach((u) => {
    map[u.id] = { hp: u.hp, shields: u.shields, count: u.count, is_alive: u.is_alive };
  });
  return map;
}

function anchorOf(unitId) {
  const el = document.querySelector(`[data-unit-id="${unitId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };
}

/**
 * Replays the battle's structured events (hits, heals, summons, waves) as timed
 * animations. While replaying, unit vitals are shown from the event stream
 * (step by step) instead of the final server state.
 */
export default function useBattleReplay(battle) {
  const [overrides, setOverrides] = useState({});
  const [fx, setFx] = useState({});            // unitId -> { kind, key }
  const [laneFx, setLaneFx] = useState({});    // lane -> key
  const [floaters, setFloaters] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [animating, setAnimating] = useState(false);
  const [announce, setAnnounce] = useState(null);   // big centred banner (boss phase / wind-up)
  const [synced, setSynced] = useState(null);       // `${battleId}:${seq}` the replay has absorbed
  const [acting, setActing] = useState(null);       // { id, side, name, drill } — whose action is playing
  const [mana, setMana] = useState(null);           // mana as replayed (null = use the server value)
  const [manaPulse, setManaPulse] = useState(null); // { key, amount } on every gain / spend

  const battleRef = useRef(battle);
  const lastSeqRef = useRef(null);
  const battleIdRef = useRef(null);
  const prevUnitsRef = useRef({});
  const prevManaRef = useRef(0);
  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const aliveRef = useRef(true);
  const keyRef = useRef(0);
  const actingRef = useRef(null);

  battleRef.current = battle;
  actingRef.current = acting;
  const nextKey = () => ++keyRef.current;

  // Set on (re)mount too: StrictMode mounts → unmounts → mounts again in development.
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const floatAt = useCallback((unitId, text, tone) => {
    const a = anchorOf(unitId);
    if (!a) return;
    const key = nextKey();
    const jitter = (key % 3 - 1) * 14;
    setFloaters((f) => [...f, { key, x: a.x + jitter, y: a.top + 6, text, tone }]);
    setTimeout(() => aliveRef.current && setFloaters((f) => f.filter((x) => x.key !== key)), T.floater);
  }, []);

  /**
   * Fire a projectile (or a melee slash) from one unit to another.
   * Returns how long it takes to land, so the hit is applied on arrival.
   */
  const shoot = useCallback((fromId, toId, tone) => {
    const a = anchorOf(fromId);
    const b = anchorOf(toId);
    if (!a || !b || fromId === toId) return 0;
    const source = (battleRef.current?.units || []).find((u) => u.id === fromId);
    const style = tone === 'heal' ? 'heal' : projectileStyleFor(source);
    const f = FLIGHT[style];
    const small = tone === 'volley';
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const travel = Math.round(Math.min(f.max, f.base + dist * f.perPx) * (small ? 0.85 : 1));
    const key = nextKey();
    setProjectiles((list) => [...list, {
      key, style, small, crit: tone === 'crit', travel,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      path: flightPath(a, b, f.arc),
      color: slashColorFor(source),
    }]);
    setTimeout(() => aliveRef.current && setProjectiles((list) => list.filter((x) => x.key !== key)), travel + T.impact);
    return travel;
  }, []);

  const shout = (data) => {
    const key = nextKey();
    setAnnounce({ ...data, key });
    setTimeout(() => aliveRef.current && setAnnounce((a) => (a?.key === key ? null : a)), T.announce);
  };

  const mark = (unitId, kind) => {
    if (!unitId) return;
    setFx((f) => ({ ...f, [unitId]: { kind, key: nextKey() } }));
  };

  const applyVitals = (unitId, vitals) => {
    setOverrides((o) => ({ ...o, [unitId]: { ...(o[unitId] || {}), ...vitals } }));
  };

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    // A troop deployment (mana spend + drop-in) plays without closing the player's turn.
    const quiet = queueRef.current.every((e) => e.type === 'mana' || (e.type === 'summon' && e.deploy));
    if (!quiet) setAnimating(true);
    setOverrides({ ...prevUnitsRef.current });
    setMana(prevManaRef.current);

    try {
    while (queueRef.current.length && aliveRef.current) {
      const ev = queueRef.current.shift();
      if (ev.type !== 'mana' && !(ev.type === 'summon' && ev.deploy)) setAnimating(true);
      const units = battleRef.current?.units || [];
      switch (ev.type) {
        case 'turn': {
          const actorUnit = units.find((u) => u.id === ev.actor_id);
          const side = ev.drill ? ev.side : actorUnit?.side;
          if (ev.drill) {
            units
              .filter((u) => u.kind === 'TROOP' && u.side === ev.side && u.lane === ev.lane)
              .forEach((u) => mark(u.id, side === 'ENEMY' ? 'windup' : 'attack'));
          } else {
            mark(ev.actor_id, side === 'ENEMY' ? 'windup' : 'attack');
          }
          setActing({
            id: ev.actor_id || null,
            side,
            drill: !!ev.drill,
            lane: ev.lane ?? actorUnit?.lane ?? null,
            name: ev.drill ? (side === 'ENEMY' ? 'Hostile troops' : 'Your troops') : actorUnit?.name || 'Unknown',
          });
          // Hostiles telegraph: they glow for a beat before striking.
          await sleep(side === 'ENEMY' ? T.enemyWindup : T.turn);
          break;
        }
        case 'ability':
          mark(ev.actor_id, 'attack');
          floatAt(ev.actor_id, ev.name, 'ability');
          await sleep(T.ability);
          break;
        case 'hit': {
          mark(ev.source_id, 'attack');
          await sleep(shoot(ev.source_id, ev.target_id, ev.volley ? 'volley' : ev.crit ? 'crit' : 'hero'));
          mark(ev.target_id, ev.crit ? 'crit' : 'hit');
          applyVitals(ev.target_id, { hp: ev.hp, shields: ev.shields, count: ev.count });
          if (ev.absorbed > 0) floatAt(ev.target_id, `-${ev.absorbed}`, 'shield');
          if (ev.hull > 0) floatAt(ev.target_id, ev.crit ? `CRIT -${ev.hull}` : `-${ev.hull}`, ev.crit ? 'crit' : 'damage');
          if (!ev.alive) {
            await sleep(160);
            floatAt(ev.target_id, 'DESTROYED', 'death');
            applyVitals(ev.target_id, { is_alive: false });
          }
          await sleep(ev.volley ? T.volleyHit : T.hit);
          break;
        }
        case 'heal':
          await sleep(shoot(ev.source_id, ev.target_id, 'heal'));
          mark(ev.target_id, 'heal');
          applyVitals(ev.target_id, { hp: ev.hp, count: ev.count });
          if (ev.amount > 0) floatAt(ev.target_id, `+${ev.amount}`, 'heal');
          await sleep(T.heal);
          break;
        case 'shield':
          mark(ev.target_id, 'shield');
          applyVitals(ev.target_id, { shields: ev.shields });
          floatAt(ev.target_id, `+${ev.amount} SHIELD`, 'shield');
          await sleep(T.shield);
          break;
        case 'summon':
          if (ev.deploy) floatAt(ev.unit_id, 'DEPLOYED', 'buff');
          else floatAt(ev.source_id, `+ ${ev.name}`, 'heal');
          mark(ev.unit_id, 'heal');
          await sleep(T.summon);
          break;
        case 'mana':
          setMana(ev.mana);
          setManaPulse({ key: nextKey(), amount: ev.amount });
          if (ev.amount > 0 && ev.unit_id && ev.reason === 'kill') floatAt(ev.unit_id, `+${ev.amount} MANA`, 'mana');
          await sleep(ev.amount > 0 ? T.mana : 0);
          break;
        case 'effect': {
          const label = ev.action === 'applied' ? `${ev.is_buff ? '▲' : '▼'} ${ev.label}`
            : ev.action === 'removed' ? `✕ ${ev.label}`
            : ev.action === 'stolen' ? `STOLEN ${ev.label}`
            : ev.action === 'skip' ? 'STUNNED'
            : ev.label;
          const tone = ev.action === 'resisted' || ev.action === 'blocked' ? 'resist'
            : ev.action === 'removed' || ev.action === 'stolen' ? 'passive'
            : ev.is_buff ? 'buff' : 'debuff';
          mark(ev.target_id, ev.is_buff && ev.action === 'applied' ? 'heal' : ev.action === 'applied' || ev.action === 'skip' ? 'hit' : 'shield');
          floatAt(ev.target_id, label, tone);
          await sleep(T.effect);
          break;
        }
        case 'dot':
          mark(ev.target_id, 'hit');
          applyVitals(ev.target_id, { hp: ev.hp, shields: ev.shields, count: ev.count });
          floatAt(ev.target_id, `-${ev.damage} ${ev.label}`, 'damage');
          if (!ev.alive) {
            await sleep(160);
            floatAt(ev.target_id, 'DESTROYED', 'death');
            applyVitals(ev.target_id, { is_alive: false });
          }
          await sleep(T.dot);
          break;
        case 'passive':
          floatAt(ev.unit_id, `★ ${ev.text}`, 'passive');
          await sleep(T.passive);
          break;
        case 'telegraph': {
          if (ev.action === 'charge') {
            ev.lanes.forEach((l) => setLaneFx((x) => ({ ...x, [l]: nextKey() })));
            floatAt(ev.unit_id, `⚠ ${ev.name}`, 'ability');
            shout({
              kicker: 'INCOMING',
              title: ev.name.toUpperCase(),
              subtitle: `${ev.lanes.length === 3 ? 'All lanes' : ev.lanes.map((l) => ['Left flank', 'Center', 'Right flank'][l]).join(' + ')} · in ${ev.turns} boss turn${ev.turns > 1 ? 's' : ''} — brace or stun!`,
              tone: 'telegraph',
            });
          } else if (ev.action === 'interrupted') {
            mark(ev.unit_id, 'hit');
            floatAt(ev.unit_id, `${ev.name} INTERRUPTED`, 'resist');
          } else {
            mark(ev.unit_id, 'attack');
            floatAt(ev.unit_id, `${ev.name}!`, 'crit');
          }
          await sleep(T.telegraph);
          break;
        }
        case 'phase':
          mark(ev.unit_id, 'crit');
          shout({ kicker: `PHASE ${ev.phase + 1}`, title: ev.name.toUpperCase(), subtitle: ev.description, tone: 'phase' });
          await sleep(T.phase);
          break;
        case 'wave':
          setLaneFx((l) => ({ ...l, [ev.lane]: nextKey() }));
          await sleep(T.wave);
          break;
        case 'end': {
          const wasEnemy = actingRef.current?.side === 'ENEMY';
          setFx({});
          await sleep(wasEnemy ? T.enemyEndGap : T.endGap);
          setActing(null);
          break;
        }
        default:
          break;
      }
    }

    } finally {
      // Always release the lock so a later batch (or a remount) can replay again.
      runningRef.current = false;
      prevUnitsRef.current = snapshot(battleRef.current?.units);
      prevManaRef.current = battleRef.current?.mana ?? 0;
      queueRef.current = aliveRef.current ? queueRef.current : [];
      if (aliveRef.current) {
        setMana(null);
        setFx({});
        setOverrides({});
        setActing(null);
        setAnimating(false);
      }
    }
    // Events that arrived during the last step: keep going.
    if (aliveRef.current && queueRef.current.length) run();
  }, [floatAt, shoot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!battle) return;
    const fresh = battleIdRef.current !== battle.id || lastSeqRef.current === null;
    if (fresh) {
      battleIdRef.current = battle.id;
      lastSeqRef.current = battle.event_seq || 0;
      prevUnitsRef.current = snapshot(battle.units);
      prevManaRef.current = battle.mana ?? 0;
      queueRef.current = [];
      setSynced(`${battle.id}:${battle.event_seq || 0}`);
      return;
    }
    const newEvents = (battle.events || []).filter((e) => e.seq > lastSeqRef.current);
    lastSeqRef.current = battle.event_seq || lastSeqRef.current;
    setSynced(`${battle.id}:${battle.event_seq || 0}`);
    if (!newEvents.length) {
      if (!runningRef.current) {
        prevUnitsRef.current = snapshot(battle.units);
        prevManaRef.current = battle.mana ?? 0;
      }
      return;
    }
    queueRef.current.push(...newEvents);
    run();
  }, [battle?.id, battle?.event_seq, run]); // eslint-disable-line react-hooks/exhaustive-deps

  // True only once every event of the current battle state has been played. On the render
  // where a new state arrives, the effect above hasn't queued its events yet — not settled.
  const settled = !animating && !!battle && synced === `${battle.id}:${battle.event_seq || 0}`;

  return { overrides, fx, laneFx, floaters, projectiles, animating, announce, acting, settled, mana, manaPulse };
}
