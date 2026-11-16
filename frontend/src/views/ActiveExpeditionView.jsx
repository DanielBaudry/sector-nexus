import React, { useEffect, useState, useRef } from 'react';
import { Swords, Shield, Trophy, Skull, Zap, Radio } from 'lucide-react';
import HealthShieldBar from '../components/HealthShieldBar';
import CardChoice from '../components/CardChoice';
import TimerBar from '../components/TimerBar';
import { api } from '../services/api';

// ── Portrait image map ────────────────────────────────────────────────────────
const PROFILE_IMAGES = {
  'Jim Raynor':       '/assets/characters/raynor.jpg',
  'Nova Terra':       '/assets/characters/nova.jpg',
  'Sarah Kerrigan':   '/assets/characters/kerrigan.jpg',
  'Prelate Zeratul':  '/assets/characters/zeratul.jpg',
  'Hierarch Artanis': '/assets/characters/artanis.svg',
  'Lieutenant Lisa':  '/assets/characters/medic.svg',
};

function getPortrait(name) {
  for (const [key, val] of Object.entries(PROFILE_IMAGES)) {
    if (name?.includes(key.split(' ')[1] || key)) return val;
  }
  return PROFILE_IMAGES[name] || '/assets/characters/raynor.jpg';
}

// ── Faction color helper ──────────────────────────────────────────────────────
function factionAccent(faction = '') {
  if (faction.includes('Terran'))  return 'border-blue-400/60  shadow-blue-500/20';
  if (faction.includes('Bio'))     return 'border-purple-400/60 shadow-purple-500/20';
  if (faction.includes('Astral'))  return 'border-amber-400/60  shadow-amber-500/20';
  return 'border-cyan-400/60 shadow-cyan-500/20';
}

export default function ActiveExpeditionView({
  expedition,
  onCombatUpdated,
  onExpeditionFinished,
  setActiveTab,
}) {
  const [submitting, setSubmitting] = useState(false);
  const logRef = useRef(null);

  // Show only last N log entries so it's always readable
  const LOG_VISIBLE = 5;
  const visibleLog = (expedition?.combat_log || []).slice(-LOG_VISIBLE);

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [expedition?.combat_log]);

  // Auto-tick when ally timer expires
  useEffect(() => {
    if (!expedition || expedition.status !== 'IN_PROGRESS') return;
    const interval = setInterval(async () => {
      const now = Date.now() / 1000;
      const isAllyTurn = expedition.current_turn_entity_type === 'ALLY';
      const expired = isAllyTurn && (now - expedition.turn_started_at) > expedition.turn_time_limit_seconds;
      if (expired || !expedition.current_turn_entity_type) {
        try {
          const updated = await api.tickExpedition();
          if (onCombatUpdated) onCombatUpdated(updated);
        } catch (err) { console.error('Combat tick error:', err); }
      }
    }, 750);
    return () => clearInterval(interval);
  }, [expedition, onCombatUpdated]);

  // Hotkeys 1 / 2 / 3
  useEffect(() => {
    const handler = (e) => {
      if (expedition?.status !== 'IN_PROGRESS' || expedition?.current_turn_entity_type !== 'ALLY' || submitting) return;
      const cards = expedition?.drawn_cards || [];
      if (e.key === '1' && cards[0]) handlePlayCard(cards[0].id);
      if (e.key === '2' && cards[1]) handlePlayCard(cards[1].id);
      if (e.key === '3' && cards[2]) handlePlayCard(cards[2].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expedition, submitting]);

  const handlePlayCard = async (cardId) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await api.sendCardChoice(cardId);
      if (onCombatUpdated) onCombatUpdated(updated);
    } catch (err) { console.error('Card play error:', err); }
    finally { setSubmitting(false); }
  };

  const handleTimerTimeout = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await api.sendCardChoice(null);
      if (onCombatUpdated) onCombatUpdated(updated);
    } catch (err) { console.error('Timeout error:', err); }
    finally { setSubmitting(false); }
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!expedition) {
    return (
      <div className="hud-panel rounded-2xl p-10 text-center max-w-lg mx-auto border border-cyan-500/20 my-10">
        <Swords className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="font-orbitron font-bold text-lg text-slate-100">NO COMBAT MISSION ACTIVE</h3>
        <p className="text-xs font-mono text-slate-400 mt-1 mb-5">
          Select an expedition sector from the map to launch tactical combat.
        </p>
        <button
          onClick={() => setActiveTab('expeditions')}
          className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase"
        >
          Open Sector Map
        </button>
      </div>
    );
  }

  const isAllyTurn = expedition.current_turn_entity_type === 'ALLY';
  const activeAlly = expedition.allies?.find((a) => a.id === expedition.current_turn_entity_id);

  return (
    <div className="h-[calc(100vh-115px)] flex flex-col gap-1.5 overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TOP: ENEMY TEAM                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="hud-panel rounded-xl px-3 py-2 border border-red-500/30 bg-[#0c0812]/95 shrink-0">
        {/* Mission status bar */}
        <div className="flex items-center justify-between font-mono text-[10px] mb-2 pb-1.5 border-b border-red-500/15">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-orbitron font-bold text-slate-100 text-[11px] tracking-wider">
              {expedition.biome_name.toUpperCase()}
            </span>
            <span className="px-1.5 py-px rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              ROOM {expedition.room_index + 1} / {expedition.total_rooms}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-amber-400 font-bold">+{expedition.accumulated_rewards?.credits || 0} CR</span>
            <span className="text-cyan-400 font-bold">+{expedition.accumulated_rewards?.crystals || 0} CRYS</span>
            <span className="text-red-400 font-bold uppercase tracking-wider">
              HOSTILES: {expedition.enemies?.filter((e) => e.is_alive).length}/{expedition.enemies?.length}
            </span>
          </div>
        </div>

        {/* Enemy cards */}
        <div className="flex items-stretch justify-center gap-3">
          {expedition.enemies?.map((enemy) => {
            const alive = enemy.is_alive !== false;
            return (
              <div
                key={enemy.id}
                className={`relative flex flex-col overflow-hidden rounded-xl border transition-all ${
                  !alive
                    ? 'opacity-30 grayscale bg-slate-950 border-slate-800 w-44'
                    : enemy.is_elite
                    ? 'w-52 bg-gradient-to-b from-[#2a0a14] to-[#140508] border-red-500/70 shadow-lg shadow-red-500/25'
                    : 'w-44 bg-[#180a10] border-red-900/60 hover:border-red-500/40'
                }`}
              >
                {/* Enemy avatar area */}
                <div className="relative h-20 bg-gradient-to-b from-red-950/60 to-black/80 flex items-center justify-center overflow-hidden">
                  {/* Abstract threat indicator */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    enemy.is_elite ? 'bg-red-900/80 border-2 border-red-400 shadow-lg shadow-red-500/40' : 'bg-red-950/80 border border-red-700'
                  }`}>
                    {enemy.is_elite ? (
                      <span className="text-amber-300 font-black text-xs font-orbitron animate-pulse">BOSS</span>
                    ) : (
                      <Skull className="w-7 h-7 text-red-400" />
                    )}
                  </div>
                  {/* Scanlines overlay */}
                  <div className="absolute inset-0 opacity-10 scanlines pointer-events-none" />
                  {!alive && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <span className="font-orbitron text-[10px] text-red-400 font-bold tracking-widest">NEUTRALIZED</span>
                    </div>
                  )}
                </div>

                {/* Enemy info + HP */}
                <div className="p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron font-bold text-[11px] text-slate-100 truncate">{enemy.name}</span>
                    {enemy.is_elite && (
                      <span className="text-[8px] font-mono px-1 rounded bg-red-950 text-red-300 border border-red-500/40 shrink-0 ml-1">ELITE</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">ATK {enemy.attack} · DEF {enemy.defense}</span>
                  <HealthShieldBar
                    name=""
                    hp={enemy.hp}
                    maxHp={enemy.max_hp}
                    shields={enemy.shields}
                    maxShields={enemy.max_shields}
                    turnMeter={enemy.turn_meter}
                    isAlive={alive}
                    showTurnMeter={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MIDDLE: CINEMATIC COMBAT LOG (subtitle-style, fading messages)        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="hud-panel rounded-xl px-4 py-2 border border-slate-800/60 bg-[#040814]/80 shrink-0 h-24 overflow-hidden relative">
        <div className="absolute top-2 left-3 flex items-center gap-1.5 font-mono text-[9px] text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          ENCOUNTER LOG
        </div>
        <div ref={logRef} className="mt-5 space-y-0.5 overflow-hidden">
          {visibleLog.map((log, i) => {
            const isCrit    = log.includes('CRITICAL');
            const isKill    = log.includes('defeated') || log.includes('neutralized');
            const isHeal    = log.includes('healed') || log.includes('HP');
            const isTimeout = log.includes('expired') || log.includes('Gambit');
            const opacity   = i < visibleLog.length - 2 ? 'opacity-40' : i < visibleLog.length - 1 ? 'opacity-70' : 'opacity-100';

            let colorClass = 'text-slate-300';
            if (isCrit) colorClass = 'text-amber-400 font-bold';
            if (isKill) colorClass = 'text-red-400 font-bold';
            if (isHeal) colorClass = 'text-emerald-400';
            if (isTimeout) colorClass = 'text-cyan-300 italic';

            return (
              <div key={i} className={`font-mono text-[11px] leading-tight transition-opacity ${colorClass} ${opacity}`}>
                {log}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* BOTTOM: STRIKE TEAM (center-left) + COMPETENCES (right)              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-2 shrink-0 items-stretch flex-1 min-h-0">

        {/* ── STRIKE TEAM PORTRAITS ── */}
        <div className="flex-1 hud-panel rounded-xl p-2 border border-cyan-500/20 bg-[#060c18]/95 flex flex-col">
          <div className="flex items-center justify-between font-mono text-[9px] text-cyan-400 border-b border-slate-800 pb-1 mb-2">
            <span className="flex items-center gap-1 font-bold">
              <Shield className="w-3 h-3" /> STRIKE TEAM
            </span>
            <span>{expedition.allies?.filter((a) => a.is_alive).length}/{expedition.allies?.length} READY</span>
          </div>

          {/* Champion portrait cards — big and image-first */}
          <div className="grid grid-cols-4 gap-2 flex-1">
            {expedition.allies?.map((ally) => {
              const isCurrent = isAllyTurn && ally.id === expedition.current_turn_entity_id;
              const isAlive = ally.is_alive !== false;
              const portrait = getPortrait(ally.name);
              const accent = factionAccent(ally.faction);

              return (
                <div
                  key={ally.id}
                  className={`relative rounded-xl border overflow-hidden flex flex-col transition-all duration-200 ${
                    !isAlive
                      ? 'opacity-30 grayscale border-slate-800 bg-slate-950'
                      : isCurrent
                      ? `border-cyan-300 shadow-xl shadow-cyan-500/30 ring-2 ring-cyan-400 scale-[1.03] bg-[#0a1930]`
                      : `${accent} bg-[#070e1c] hover:brightness-110`
                  }`}
                >
                  {/* Portrait — big, top-dominant */}
                  <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
                    <img
                      src={portrait}
                      alt={ally.name}
                      className="w-full h-full object-cover object-top"
                      style={{ minHeight: '90px' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {/* Gradient at bottom to blend into info */}
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/90 to-transparent" />

                    {/* TURN badge overlaid on portrait */}
                    {isCurrent && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-mono font-bold text-cyan-300 bg-cyan-950/90 px-1 rounded animate-pulse border border-cyan-400 z-10">
                        TURN
                      </span>
                    )}

                    {/* Role badge */}
                    <span className="absolute top-1.5 left-1.5 text-[8px] font-mono px-1 py-px rounded bg-black/70 text-slate-300 border border-slate-700 z-10">
                      {ally.role}
                    </span>

                    {/* Dead overlay */}
                    {!isAlive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Skull className="w-8 h-8 text-red-500/60" />
                      </div>
                    )}
                  </div>

                  {/* Info + bars — compact below portrait */}
                  <div className="px-1.5 py-1 bg-black/80">
                    <span className="font-orbitron font-bold text-[9px] text-slate-100 block truncate leading-tight">
                      {ally.name.split(' ').slice(-1)[0]}
                    </span>
                    <HealthShieldBar
                      name=""
                      hp={ally.hp}
                      maxHp={ally.max_hp}
                      shields={ally.shields}
                      maxShields={ally.max_shields}
                      turnMeter={ally.turn_meter}
                      isAlive={isAlive}
                      showTurnMeter={true}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COMPETENCE CARDS + TIMER ── */}
        <div className="w-56 hud-panel rounded-xl p-2 border-2 border-cyan-500/50 bg-[#071329]/95 flex flex-col gap-1.5 shadow-2xl shrink-0">
          {/* Header & timer */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <div className="flex items-center gap-1 text-cyan-300 font-bold">
                <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400 animate-bounce" />
                <span className="font-orbitron text-[11px] truncate">
                  {isAllyTurn ? activeAlly?.name.split(' ').slice(-1)[0].toUpperCase() : 'STANDBY'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">[1] [2] [3]</span>
            </div>

            {isAllyTurn ? (
              <TimerBar
                startedAt={expedition.turn_started_at}
                durationSeconds={expedition.turn_time_limit_seconds || 7.0}
                onTimeout={handleTimerTimeout}
              />
            ) : (
              <div className="w-full py-1 text-center font-mono text-[9px] text-slate-500 bg-slate-900/60 rounded border border-slate-800">
                AWAITING INITIATIVE...
              </div>
            )}
          </div>

          {/* Card slots — vertical CCG style */}
          <div className="flex flex-col gap-1.5 flex-1">
            {isAllyTurn && expedition.drawn_cards?.length > 0 ? (
              expedition.drawn_cards.map((card, idx) => (
                <CardChoice
                  key={card.id}
                  card={card}
                  index={idx}
                  disabled={submitting}
                  onSelect={handlePlayCard}
                />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-[10px] text-center px-2">
                Cards activate on operative initiative.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VICTORY / DEFEAT MODAL                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {expedition.status !== 'IN_PROGRESS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className={`w-full max-w-md rounded-2xl p-6 border text-center shadow-2xl ${
              expedition.status === 'VICTORY'
                ? 'bg-gradient-to-b from-cyan-950/90 to-slate-950 border-cyan-400 shadow-cyan-500/30'
                : 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-500 shadow-red-500/30'
            }`}
          >
            {expedition.status === 'VICTORY' ? (
              <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
            ) : (
              <Skull className="w-16 h-16 text-red-500 mx-auto mb-3" />
            )}

            <h3 className="font-orbitron font-black text-2xl text-slate-100">
              {expedition.status === 'VICTORY' ? 'SECTOR SECURED // VICTORY!' : 'MISSION FAILED // DEFEAT'}
            </h3>
            <p className="text-xs font-mono text-slate-300 mt-1 mb-5">
              {expedition.status === 'VICTORY'
                ? 'All hostile bio-signatures and mechs neutralized in target biome.'
                : 'Operatives took critical damage and were evacuated by drop-ship.'}
            </p>

            {/* Reward Summary */}
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700 font-mono text-xs space-y-2 mb-6">
              <span className="text-[10px] text-slate-400 uppercase block">HARVESTED REWARDS</span>
              <div className="flex justify-around">
                <div>
                  <span className="text-slate-400 block text-[10px]">CREDITS</span>
                  <span className="text-amber-400 font-bold text-sm">+{expedition.accumulated_rewards?.credits}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CRYSTALS</span>
                  <span className="text-cyan-400 font-bold text-sm">+{expedition.accumulated_rewards?.crystals}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPERIENCE</span>
                  <span className="text-purple-400 font-bold text-sm">+{expedition.accumulated_rewards?.experience}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (onExpeditionFinished) onExpeditionFinished();
                setActiveTab('deck');
              }}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase tracking-wider"
            >
              Collect Rewards &amp; Return to Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
