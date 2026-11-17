import React, { useState } from 'react';
import { Swords, Trophy, Skull, Map as MapIcon, Users, Heart, ArrowRight, Rocket, AlertTriangle, X, Crosshair, Crown, Dna } from 'lucide-react';
import { api } from '../services/api';
import RunNodeMap, { NODE_STYLE } from '../components/run/RunNodeMap';
import LaneBattleBoard from '../components/run/LaneBattleBoard';
import ObjectiveTracker from '../components/run/ObjectiveTracker';
import { factionTone, getPortrait, pct } from '../utils/battleVisuals';
import ArtifactCard from '../components/ArtifactCard';

function LootList({ artifacts = [], title }) {
  if (!artifacts.length) return null;
  return (
    <div className="text-left">
      {title && <div className="font-mono text-[12px] text-slate-400 uppercase mb-1">{title}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
        {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} compact />)}
      </div>
    </div>
  );
}

function Rewards({ rewards }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[12px]">
      <span className="text-amber-400 font-bold">+{rewards?.credits || 0} CR</span>
      <span className="text-cyan-400 font-bold">+{rewards?.crystals || 0} CRYS</span>
      <span className="text-purple-400 font-bold">+{rewards?.champion_xp || 0} XP</span>
      {rewards?.artifacts?.length > 0 && (
        <span className="text-emerald-300 font-bold">+{rewards.artifacts.length} ARTIFACT{rewards.artifacts.length > 1 ? 'S' : ''}</span>
      )}
    </div>
  );
}

function RosterPanel({ run }) {
  return (
    <div className="space-y-1.5">
      {run.heroes.map((h) => {
        const tone = factionTone(h.faction);
        const packs = run.troops.filter((t) => t.owner_id === h.id && t.is_alive);
        const portrait = getPortrait(h.name);
        return (
          <div key={h.id} className={`rounded-lg border p-1.5 bg-black/50 ${h.is_alive ? tone.border : 'border-slate-800 opacity-40 grayscale'}`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover object-top" /> : h.is_alive ? <Users className={`w-4 h-4 ${tone.text}`} /> : <Skull className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between font-orbitron text-[12px] font-bold text-slate-100">
                  <span className="truncate">{h.name}</span>
                  {!h.is_alive && <span className="text-red-400 font-mono text-[11px]">KIA</span>}
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden mt-0.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct(h.hp, h.max_hp)}%` }} />
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5" /> {h.hp}/{h.max_hp}
                </div>
              </div>
            </div>
            {packs.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {packs.map((p) => (
                  <span key={p.id} className={`font-mono text-[11px] px-1 rounded border ${tone.border} ${tone.text} bg-black/40`}>
                    {p.name} ×{p.count}/{p.max_count}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExpeditionRunView({ run, onRunUpdated, onRunCleared, setActiveTab }) {
  const [busy, setBusy] = useState(false);
  const [dismissedBattleId, setDismissedBattleId] = useState(null);
  const [error, setError] = useState(null);
  const [boardAnimating, setBoardAnimating] = useState(false);
  const [confirmExtract, setConfirmExtract] = useState(false);

  if (!run) {
    return (
      <div className="hud-panel rounded-2xl p-10 text-center max-w-lg mx-auto border border-cyan-500/20 my-10">
        <Swords className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="font-orbitron font-bold text-lg text-slate-100">NO EXPEDITION ACTIVE</h3>
        <p className="text-xs font-mono text-slate-400 mt-1 mb-5">Pick a planet on the sector map and launch a Live Descent.</p>
        <button onClick={() => setActiveTab('expeditions')} className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase">
          Open Sector Map
        </button>
      </div>
    );
  }

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      if (updated) onRunUpdated(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const finished = ['VICTORY', 'DEFEAT', 'ABANDONED'].includes(run.status);
  const battle = run.battle;
  const showBoard = battle && (run.status === 'DEPLOYMENT' || run.status === 'BATTLE' || (battle.status !== 'DEPLOYMENT' && dismissedBattleId !== battle.id));
  const battleReport = battle && ['WON', 'LOST'].includes(battle.status) && dismissedBattleId !== battle.id;
  const currentNode = run.nodes.find((n) => n.id === run.current_node_id);
  const nodeStyle = NODE_STYLE[currentNode?.type] || NODE_STYLE.COMBAT;
  const bossMode = run.mode === 'boss';

  const abandon = () => {
    setConfirmExtract(false);
    act(() => api.abandonRun());
  };

  const closeRun = async () => {
    try { await api.dismissRun(); } catch (e) { /* already cleared */ }
    await onRunCleared();
  };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {/* Run header */}
      <div className="shrink-0 hud-panel rounded-xl px-3 py-2 border border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-orbitron font-bold text-slate-100 text-[13px] tracking-wider truncate">{run.biome_name.toUpperCase()}</span>
          {bossMode ? (
            <span className="px-1.5 py-px rounded bg-orange-950/70 text-orange-300 border border-orange-500/50 font-mono text-[12px]">
              BOSS ENCOUNTER
            </span>
          ) : (
            <span className="px-1.5 py-px rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono text-[12px]">
              DEPTH {currentNode?.row ?? 0}/{Math.max(...run.nodes.map((n) => n.row))}
            </span>
          )}
          {run.difficulty > 1 && (
            <span className="px-1.5 py-px rounded bg-red-950/60 text-red-300 border border-red-500/40 font-mono text-[12px]">
              DIFFICULTY {run.difficulty}
            </span>
          )}
          {run.influence && (
            <span className="flex items-center gap-1 px-1.5 py-px rounded bg-cyan-950/70 text-cyan-200 border border-cyan-500/50 font-mono text-[12px]" title="Influence gathered this run (banked when it ends)">
              <Crosshair className="w-3 h-3" /> {run.influence.target_name.toUpperCase()} +{run.influence.gained}
            </span>
          )}
          <span className="px-1.5 py-px rounded border font-mono text-[12px]" style={{ borderColor: nodeStyle.color, color: nodeStyle.color }}>
            {run.status === 'MAP' ? 'NAVIGATING' : run.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Rewards rewards={run.rewards} />
          {!finished && (
            <button
              onClick={() => setConfirmExtract(true)}
              disabled={busy}
              title="Leave the expedition now — keep half of the loot"
              className="group relative flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border border-red-300/60 text-white font-orbitron font-black text-xs tracking-widest shadow-lg shadow-red-900/60 disabled:opacity-50"
            >
              <span className="absolute inset-0 rounded-lg ring-2 ring-red-400/60 animate-pulse pointer-events-none" />
              <Rocket className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              <span className="leading-none text-left">
                EXTRACT
                <span className="block font-mono font-normal text-[11px] tracking-normal text-red-100/80">keep 50% loot</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {showBoard ? (
          <LaneBattleBoard run={run} onRunUpdated={onRunUpdated} onAnimatingChange={setBoardAnimating} />
        ) : (
          <div className="h-full flex flex-col lg:flex-row gap-2 min-h-0">
            <div className="flex-1 hud-panel rounded-xl border border-cyan-500/20 p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between font-mono text-[12px] text-slate-400 mb-1">
                <span className="flex items-center gap-1.5"><MapIcon className="w-3.5 h-3.5 text-cyan-400" /> PLANETARY ROUTE</span>
                <span>{run.status === 'MAP' ? 'SELECT A GLOWING NODE' : ''}</span>
              </div>
              <div className="flex-1 min-h-0">
                <RunNodeMap
                  nodes={run.nodes}
                  currentNodeId={run.current_node_id}
                  reachableIds={run.reachable_node_ids}
                  busy={busy}
                  onChoose={(id) => act(() => api.chooseRunNode(id))}
                />
              </div>
              {error && <div className="font-mono text-[12px] text-red-400">{error}</div>}
            </div>
            <div className="lg:w-72 shrink-0 flex flex-col gap-2 min-h-0">
              <div className="hud-panel rounded-xl p-2 border border-cyan-500/20 overflow-y-auto">
                <div className="font-mono text-[11px] text-slate-400 mb-1.5">STRIKE TEAM</div>
                <RosterPanel run={run} />
              </div>
              <div className="hud-panel rounded-xl p-2 border border-slate-800 flex-1 min-h-[100px] overflow-y-auto">
                <div className="font-mono text-[11px] text-slate-500 mb-1">EXPEDITION LOG</div>
                {[...run.log].reverse().map((l, i) => (
                  <div key={i} className={`font-mono text-[12px] leading-tight ${i === 0 ? 'text-slate-100' : 'text-slate-500'}`}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extraction confirmation */}
      {confirmExtract && !finished && (() => {
        const r = run.rewards || {};
        const arts = r.artifacts?.length || 0;
        const keep = (v) => Math.floor((v || 0) / 2);
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmExtract(false)}>
            <div className="w-full max-w-md rounded-2xl p-6 border-2 border-red-500/60 bg-gradient-to-b from-red-950/90 to-slate-950 shadow-2xl shadow-red-900/50" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-400/60 flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-red-300" />
                  </div>
                  <div>
                    <div className="font-mono text-[12px] tracking-widest text-red-300">EMERGENCY EXTRACTION</div>
                    <h3 className="font-orbitron font-black text-lg text-slate-100">Abort the expedition?</h3>
                  </div>
                </div>
                <button onClick={() => setConfirmExtract(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <p className="mt-3 text-xs text-slate-300 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                The dropship pulls your squad out now. Only half of the loot gathered so far makes it back to base.
              </p>
              <div className="mt-4 rounded-xl border border-slate-700 bg-black/50 p-3 font-mono text-xs">
                <div className="grid grid-cols-3 text-[12px] text-slate-500 mb-1.5"><span /><span className="text-right">GATHERED</span><span className="text-right">YOU KEEP</span></div>
                {[
                  ['Credits', r.credits, keep(r.credits), 'text-amber-300'],
                  ['Crystals', r.crystals, keep(r.crystals), 'text-cyan-300'],
                  ['Champion XP', r.champion_xp, keep(r.champion_xp), 'text-purple-300'],
                  ['Artifacts', arts, Math.ceil(arts / 2), 'text-emerald-300'],
                ].map(([label, got, kept, color]) => (
                  <div key={label} className="grid grid-cols-3 py-0.5">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-right text-slate-500 line-through decoration-red-500/60">{(got || 0).toLocaleString()}</span>
                    <span className={`text-right font-bold ${color}`}>{kept.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirmExtract(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-orbitron font-bold text-xs uppercase">
                  Keep fighting
                </button>
                <button onClick={abandon} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-orbitron font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Rocket className="w-4 h-4" /> Extract now
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Battle report (run continues) */}
      {battleReport && !finished && !boardAnimating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 border border-emerald-400/70 bg-gradient-to-b from-emerald-950/80 to-slate-950 text-center">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <h3 className="font-orbitron font-black text-xl text-slate-100">NODE SECURED</h3>
            <div className="my-4 text-left"><ObjectiveTracker objectives={battle.objectives} /></div>
            <div className="flex justify-center mb-3"><Rewards rewards={battle.rewards} /></div>
            <div className="mb-4"><LootList artifacts={battle.rewards?.artifacts} title="Artifacts recovered" /></div>
            <p className="font-mono text-[12px] text-slate-400 mb-4">Wounds and troop losses carry over. Rest at a field camp to recover.</p>
            <button
              onClick={() => setDismissedBattleId(battle.id)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              Return to Route <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Run over */}
      {finished && !boardAnimating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 border text-center ${
            run.status === 'VICTORY' ? 'bg-gradient-to-b from-cyan-950/90 to-slate-950 border-cyan-400' : 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-500'
          }`}>
            {run.status === 'VICTORY' ? <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" /> : <Skull className="w-16 h-16 text-red-500 mx-auto mb-3" />}
            <h3 className="font-orbitron font-black text-2xl text-slate-100">
              {run.status === 'VICTORY'
                ? (bossMode ? 'BOSS SLAIN' : 'PLANET CONQUERED')
                : run.status === 'ABANDONED' ? 'EXTRACTION COMPLETE' : bossMode ? 'SQUAD WIPED' : 'EXPEDITION LOST'}
            </h3>
            <p className="text-xs font-mono text-slate-300 mt-1 mb-4">
              {run.status === 'VICTORY'
                ? (bossMode ? 'The colossus collapses. Its hoard is yours.' : 'The apex threat is down. Full spoils secured.')
                : bossMode ? 'The boss still stands. Gear up, read its wind-ups, and try again.' : 'Survivors evacuated. Half of the gathered loot was recovered.'}
            </p>
            {battle && <div className="mb-4 text-left"><ObjectiveTracker objectives={battle.objectives} /></div>}
            {run.influence && run.influence.banked !== null && (
              <div className="mb-3 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 flex items-center justify-center gap-2 font-mono text-[13px] text-cyan-100">
                <Crosshair className="w-4 h-4" /> +{run.influence.banked} Influence banked on <b>{run.influence.target_name}</b>
                {run.influence.banked < run.influence.gained && <span className="text-slate-400">({run.influence.gained} gathered)</span>}
              </div>
            )}
            {run.hierarchy_result && (
              run.hierarchy_result.claimed ? (
                <div className="mb-3 rounded-xl border border-amber-400/60 bg-amber-950/40 px-3 py-2 flex items-center justify-center gap-2 font-orbitron text-sm text-amber-200">
                  <Crown className="w-4 h-4" /> {run.hierarchy_result.boss_name}'s seat is yours — the one above is now exposed.
                </div>
              ) : (
                <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/40 px-3 py-2 text-[13px] text-red-200">
                  <div className="flex items-center justify-center gap-2 font-orbitron font-bold"><Dna className="w-4 h-4" /> {run.hierarchy_result.boss_name} adapts: {run.hierarchy_result.adaptation.name}</div>
                  <div className="font-mono text-[12px] text-red-200/80">{run.hierarchy_result.adaptation.description} Your Influence is kept — challenge them again.</div>
                </div>
              )
            )}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 flex justify-center mb-5">
              <Rewards rewards={run.payout || run.rewards} />
            </div>
            {run.payout?.artifacts_lost > 0 && (
              <p className="font-mono text-[13px] text-amber-300 -mt-3 mb-3">{run.payout.artifacts_lost} artifact(s) lost in extraction.</p>
            )}
            <div className="mb-5"><LootList artifacts={(run.payout || run.rewards)?.artifacts} title="Artifacts banked to your vault" /></div>
            <button onClick={closeRun} className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase tracking-wider">
              Return to Command Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
