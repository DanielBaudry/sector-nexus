import { useCallback, useEffect, useRef, useState } from 'react';

// Pacing (ms). Tuned so one enemy/drill action reads in ~1s without dragging.
const T = {
  turn: 260,
  ability: 380,
  hit: 420,
  volleyHit: 300,
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
  floater: 1150,
  tracer: 420,
};

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
  const [tracers, setTracers] = useState([]);
  const [animating, setAnimating] = useState(false);
  const [announce, setAnnounce] = useState(null);   // big centred banner (boss phase / wind-up)

  const battleRef = useRef(battle);
  const lastSeqRef = useRef(null);
  const battleIdRef = useRef(null);
  const prevUnitsRef = useRef({});
  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const aliveRef = useRef(true);
  const keyRef = useRef(0);

  battleRef.current = battle;
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

  const traceLine = useCallback((fromId, toId, tone) => {
    const a = anchorOf(fromId);
    const b = anchorOf(toId);
    if (!a || !b || fromId === toId) return;
    const key = nextKey();
    setTracers((t) => [...t, { key, x1: a.x, y1: a.y, x2: b.x, y2: b.y, tone }]);
    setTimeout(() => aliveRef.current && setTracers((t) => t.filter((x) => x.key !== key)), T.tracer);
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
    setAnimating(true);
    setOverrides({ ...prevUnitsRef.current });

    try {
    while (queueRef.current.length && aliveRef.current) {
      const ev = queueRef.current.shift();
      const units = battleRef.current?.units || [];
      switch (ev.type) {
        case 'turn': {
          if (ev.drill) {
            units
              .filter((u) => u.kind === 'TROOP' && u.side === ev.side && u.lane === ev.lane)
              .forEach((u) => mark(u.id, 'attack'));
          } else {
            mark(ev.actor_id, 'attack');
          }
          await sleep(T.turn);
          break;
        }
        case 'ability':
          mark(ev.actor_id, 'attack');
          floatAt(ev.actor_id, ev.name, 'ability');
          await sleep(T.ability);
          break;
        case 'hit': {
          mark(ev.source_id, 'attack');
          traceLine(ev.source_id, ev.target_id, ev.volley ? 'volley' : ev.crit ? 'crit' : 'hero');
          await sleep(90);
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
          mark(ev.target_id, 'heal');
          traceLine(ev.source_id, ev.target_id, 'heal');
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
          floatAt(ev.source_id, `+ ${ev.name}`, 'heal');
          mark(ev.unit_id, 'heal');
          await sleep(T.summon);
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
        case 'end':
          setFx({});
          await sleep(T.endGap);
          break;
        default:
          break;
      }
    }

    } finally {
      // Always release the lock so a later batch (or a remount) can replay again.
      runningRef.current = false;
      prevUnitsRef.current = snapshot(battleRef.current?.units);
      queueRef.current = aliveRef.current ? queueRef.current : [];
      if (aliveRef.current) {
        setFx({});
        setOverrides({});
        setAnimating(false);
      }
    }
    // Events that arrived during the last step: keep going.
    if (aliveRef.current && queueRef.current.length) run();
  }, [floatAt, traceLine]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!battle) return;
    const fresh = battleIdRef.current !== battle.id || lastSeqRef.current === null;
    if (fresh) {
      battleIdRef.current = battle.id;
      lastSeqRef.current = battle.event_seq || 0;
      prevUnitsRef.current = snapshot(battle.units);
      queueRef.current = [];
      return;
    }
    const newEvents = (battle.events || []).filter((e) => e.seq > lastSeqRef.current);
    lastSeqRef.current = battle.event_seq || lastSeqRef.current;
    if (!newEvents.length) {
      if (!runningRef.current) prevUnitsRef.current = snapshot(battle.units);
      return;
    }
    queueRef.current.push(...newEvents);
    run();
  }, [battle?.id, battle?.event_seq, run]); // eslint-disable-line react-hooks/exhaustive-deps

  return { overrides, fx, laneFx, floaters, tracers, animating, announce };
}
