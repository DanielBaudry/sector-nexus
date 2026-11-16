import React, { useState } from 'react';
import { Swords, Trophy, Skull, Flag, Map as MapIcon, Users, Heart, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import RunNodeMap, { NODE_STYLE } from '../components/run/RunNodeMap';
import LaneBattleBoard from '../components/run/LaneBattleBoard';
import ObjectiveTracker from '../components/run/ObjectiveTracker';
import { factionTone, getPortrait, pct } from '../utils/battleVisuals';

function Rewards({ rewards }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px]">
      <span className="text-amber-400 font-bold">+{rewards?.credits || 0} CR</span>
      <span className="text-cyan-400 font-bold">+{rewards?.crystals || 0} CRYS</span>
      <span className="text-purple-400 font-bold">+{rewards?.experience || 0} XP</span>
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
                <div className="flex justify-between font-orbitron text-[10px] font-bold text-slate-100">
                  <span className="truncate">{h.name}</span>
                  {!h.is_alive && <span className="text-red-400 font-mono text-[9px]">KIA</span>}
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden mt-0.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct(h.hp, h.max_hp)}%` }} />
                </div>
                <div className="font-mono text-[9px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5" /> {h.hp}/{h.max_hp}
                </div>
              </div>
            </div>
            {packs.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {packs.map((p) => (
                  <span key={p.id} className={`font-mono text-[9px] px-1 rounded border ${tone.border} ${tone.text} bg-black/40`}>
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

  const abandon = () => {
    if (window.confirm('Call emergency extraction? You keep only half of the loot gathered so far.')) {
      act(() => api.abandonRun());
    }
  };

  const closeRun = async () => {
    try { await api.dismissRun(); } catch (e) { /* already cleared */ }
    onRunCleared();
    setActiveTab('deck');
  };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {/* Run header */}
      <div className="shrink-0 hud-panel rounded-xl px-3 py-2 border border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-orbitron font-bold text-slate-100 text-[11px] tracking-wider truncate">{run.biome_name.toUpperCase()}</span>
          <span className="px-1.5 py-px rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
            DEPTH {currentNode?.row ?? 0}/{Math.max(...run.nodes.map((n) => n.row))}
          </span>
          <span className="px-1.5 py-px rounded border font-mono text-[10px]" style={{ borderColor: nodeStyle.color, color: nodeStyle.color }}>
            {run.status === 'MAP' ? 'NAVIGATING' : run.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Rewards rewards={run.rewards} />
          {!finished && (
            <button onClick={abandon} disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-red-500/60 text-slate-400 hover:text-red-300 font-mono text-[10px]">
              <Flag className="w-3 h-3" /> EXTRACT
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {showBoard ? (
          <LaneBattleBoard run={run} onRunUpdated={onRunUpdated} />
        ) : (
          <div className="h-full flex flex-col lg:flex-row gap-2 min-h-0">
            <div className="flex-1 hud-panel rounded-xl border border-cyan-500/20 p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
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
              {error && <div className="font-mono text-[10px] text-red-400">{error}</div>}
            </div>
            <div className="lg:w-72 shrink-0 flex flex-col gap-2 min-h-0">
              <div className="hud-panel rounded-xl p-2 border border-cyan-500/20 overflow-y-auto">
                <div className="font-mono text-[9px] text-slate-400 mb-1.5">STRIKE TEAM</div>
                <RosterPanel run={run} />
              </div>
              <div className="hud-panel rounded-xl p-2 border border-slate-800 flex-1 min-h-[100px] overflow-y-auto">
                <div className="font-mono text-[9px] text-slate-500 mb-1">EXPEDITION LOG</div>
                {[...run.log].reverse().map((l, i) => (
                  <div key={i} className={`font-mono text-[10px] leading-tight ${i === 0 ? 'text-slate-100' : 'text-slate-500'}`}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Battle report (run continues) */}
      {battleReport && !finished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 border border-emerald-400/70 bg-gradient-to-b from-emerald-950/80 to-slate-950 text-center">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <h3 className="font-orbitron font-black text-xl text-slate-100">NODE SECURED</h3>
            <div className="my-4 text-left"><ObjectiveTracker objectives={battle.objectives} /></div>
            <div className="flex justify-center mb-4"><Rewards rewards={battle.rewards} /></div>
            <p className="font-mono text-[10px] text-slate-400 mb-4">Wounds and troop losses carry over. Rest at a field camp to recover.</p>
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
      {finished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 border text-center ${
            run.status === 'VICTORY' ? 'bg-gradient-to-b from-cyan-950/90 to-slate-950 border-cyan-400' : 'bg-gradient-to-b from-red-950/90 to-slate-950 border-red-500'
          }`}>
            {run.status === 'VICTORY' ? <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" /> : <Skull className="w-16 h-16 text-red-500 mx-auto mb-3" />}
            <h3 className="font-orbitron font-black text-2xl text-slate-100">
              {run.status === 'VICTORY' ? 'PLANET CONQUERED' : run.status === 'ABANDONED' ? 'EXTRACTION COMPLETE' : 'EXPEDITION LOST'}
            </h3>
            <p className="text-xs font-mono text-slate-300 mt-1 mb-4">
              {run.status === 'VICTORY' ? 'The apex threat is down. Full spoils secured.' : 'Survivors evacuated. Half of the gathered loot was recovered.'}
            </p>
            {battle && <div className="mb-4 text-left"><ObjectiveTracker objectives={battle.objectives} /></div>}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 flex justify-center mb-5">
              <Rewards rewards={Object.fromEntries(
                Object.entries(run.rewards).map(([k, v]) => [k, Math.floor(v * (run.status === 'VICTORY' ? 1 : 0.5))]),
              )} />
            </div>
            <button onClick={closeRun} className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase tracking-wider">
              Return to Command Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
