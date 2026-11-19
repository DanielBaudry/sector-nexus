import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Compass, Crosshair, Crown, Network, Swords, Flame, Sparkles, Radio, Skull } from 'lucide-react';
import { api } from '../services/api';
import RunSetupModal from '../components/run/RunSetupModal';
import HierarchyTree from '../components/planet/HierarchyTree';
import ChampionDetail from '../components/planet/ChampionDetail';
import { ChampionArt, InfluenceBar, StatusBadge } from '../components/planet/hierarchyUi';

export const PLANET_ICONS = { Flame, Sparkles, Compass, Radio };

/** Always-visible strip: who the planet's expeditions are currently hunting. */
function TargetStrip({ target, onOpen }) {
  if (!target) {
    return (
      <button onClick={onOpen} className="w-full rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/10 px-4 py-2.5 flex items-center gap-2 font-mono text-[13px] text-cyan-300 hover:bg-cyan-950/30">
        <Crosshair className="w-4 h-4" /> No target — open the Hierarchy and choose a champion to hunt. Expeditions build Influence against them.
      </button>
    );
  }
  return (
    <button onClick={onOpen} className="w-full rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/50 to-transparent px-3 py-2 flex items-center gap-3 text-left hover:border-cyan-300">
      <ChampionArt champion={target} className="w-12 h-12 object-contain shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-widest text-cyan-400">HUNTING</span>
          <span className="font-orbitron font-black text-slate-100 truncate">{target.name}</span>
          <span className="font-orbitron text-[13px] text-slate-400 truncate hidden sm:inline">{target.title}</span>
          <StatusBadge status={target.status} />
        </div>
        <div className="mt-1 max-w-md"><InfluenceBar value={target.standing.influence} max={target.influence_required} height="h-3" showText /></div>
      </div>
      {target.status === 'VULNERABLE' && (
        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-600 text-white font-orbitron font-black text-[12px] animate-pulse">BOSS FIGHT READY</span>
      )}
    </button>
  );
}

function ExpeditionsTab({ biome, target, runInProgress, activeRun, onLaunch, onResume }) {
  const threats = biome.difficulty_threats || [];
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-4">
          <p className="text-sm text-slate-200 leading-relaxed">{biome.description}</p>
          <div className="p-3 rounded-lg bg-black/40 border border-slate-700/80 text-[13px] font-mono flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-amber-300 font-bold uppercase block">Hazard: {biome.hazard_name}</span>
              <span className="text-slate-400">{biome.hazard_description}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap font-mono text-[12px]">
            <span className="text-slate-400 uppercase">ARTIFACT DROPS:</span>
            {biome.allowed_artifact_sets?.map((set) => (
              <span key={set} className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">{set}</span>
            ))}
          </div>
          {threats.length > 0 && (
            <div>
              <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1">THREATS AT HIGHER DIFFICULTY</div>
              <div className="flex flex-wrap gap-1.5">
                {threats.map((t) => (
                  <span key={t.name} title={t.abilities.join(', ')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-500/40 bg-red-950/40 font-mono text-[12px] text-red-200">
                    <Skull className="w-3 h-3" /> {t.name} <span className="text-red-400/80">T{t.min_tier}+</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-black/50 border border-slate-700/70 p-4 flex flex-col gap-3 backdrop-blur-sm">
          <div className="font-mono text-[11px] tracking-widest text-slate-400">LIVE DESCENT</div>
          <div className="font-mono text-[13px] text-slate-300 space-y-1">
            <div>Recommended power <b className="text-cyan-300">{biome.recommended_power}</b></div>
            {biome.max_difficulty > 1 && <div>Difficulty <b className="text-red-300">1–{biome.max_difficulty}</b></div>}
            <div className="flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              Influence → {target ? <b className="text-cyan-200">{target.name}</b> : <span className="text-slate-500">no target</span>}
            </div>
          </div>
          <button
            onClick={runInProgress ? onResume : onLaunch}
            className="mt-auto w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-orbitron font-bold text-sm uppercase tracking-wider shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4" />
            {runInProgress ? (activeRun.biome_id === biome.id ? 'Resume descent' : 'Run in progress') : 'Launch expedition'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A planet: launch expeditions, or study its enemy hierarchy and pick who to hunt.
 * Expeditions on the planet feed Influence to the targeted champion; enough Influence opens its boss fight.
 */
export default function PlanetView({ biome, squad, champions, activeRun, onStartCombat, onOpenBarracks }) {
  const [tab, setTab] = useState('expeditions');
  const [hierarchy, setHierarchy] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [setup, setSetup] = useState(null); // { boss } | { biome }
  const runInProgress = activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);

  const load = useCallback(() => {
    api.getHierarchy(biome.id)
      .then((h) => {
        setHierarchy(h);
        setSelectedId((cur) => cur || h.target_id || h.champions.find((c) => c.status !== 'LOCKED' && c.status !== 'DEFEATED')?.id || h.champions[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [biome.id]);

  useEffect(() => { load(); }, [load]);

  const champions_ = hierarchy?.champions || [];
  const hasHierarchy = champions_.length > 0;
  const target = champions_.find((c) => c.id === hierarchy?.target_id) || null;
  const selected = champions_.find((c) => c.id === selectedId) || null;
  const nameOf = (id) => champions_.find((c) => c.id === id)?.name;
  const Icon = PLANET_ICONS[biome.icon_name] || Compass;
  const defeated = champions_.filter((c) => c.status === 'DEFEATED').length;

  const setTarget = async () => {
    setBusy(true);
    setError(null);
    try {
      setHierarchy(await api.setHierarchyTarget(selected.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: 'expeditions', label: 'Expeditions', icon: Swords },
    { id: 'hierarchy', label: 'Hierarchy', icon: Network, badge: hasHierarchy ? `${defeated}/${champions_.length}` : null },
  ];

  return (
    <div className="space-y-4">
      {/* Planet header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" style={{ color: biome.color }} /> SECTOR MAP · PLANET
          </div>
          <h2 className="font-orbitron font-black text-3xl text-slate-100 leading-tight" style={{ textShadow: `0 0 24px ${biome.color}66` }}>{biome.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[12px]">
            <span className="px-1.5 rounded bg-black/50 border border-slate-700 text-cyan-300">REC POWER {biome.recommended_power}</span>
            {biome.max_difficulty > 1 && <span className="px-1.5 rounded bg-red-950/60 border border-red-500/40 text-red-300">DIFFICULTY 1–{biome.max_difficulty}</span>}
            {hasHierarchy && <span className="px-1.5 rounded bg-black/50 border border-amber-500/40 text-amber-200">HIERARCHY {defeated}/{champions_.length} FALLEN</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1 p-1 rounded-xl bg-black/50 border border-slate-800 w-fit">
        {tabs.map((t) => {
          const TIcon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-orbitron font-bold text-xs uppercase tracking-wider transition ${
                active ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <TIcon className="w-4 h-4" /> {t.label}
              {t.badge && <span className={`font-mono text-[11px] px-1 rounded ${active ? 'bg-black/20' : 'bg-slate-800 text-slate-300'}`}>{t.badge}</span>}
            </button>
          );
        })}
      </div>

      {hasHierarchy && <TargetStrip target={target} onOpen={() => { setTab('hierarchy'); if (target) setSelectedId(target.id); }} />}
      {error && <div className="font-mono text-[13px] text-red-400">{error}</div>}

      {tab === 'expeditions' && (
        <ExpeditionsTab
          biome={biome}
          target={target}
          runInProgress={runInProgress}
          activeRun={activeRun}
          onLaunch={() => setSetup({ biome })}
          onResume={() => onStartCombat?.(activeRun)}
        />
      )}

      {tab === 'hierarchy' && (
        hasHierarchy ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-black/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> CHAIN OF COMMAND
                </span>
                <span className="font-mono text-[11px] text-slate-500">Fell a champion to expose the one above</span>
              </div>
              <HierarchyTree champions={champions_} targetId={hierarchy.target_id} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            {selected && (
              <ChampionDetail
                champion={selected}
                superiorName={nameOf(selected.superior_id)}
                subordinateNames={selected.subordinate_ids.map(nameOf)}
                isTarget={hierarchy.target_id === selected.id}
                rules={hierarchy.influence_rules}
                busy={busy || !!runInProgress}
                onTarget={setTarget}
                onFight={() => setSetup({ boss: selected })}
              />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-black/40 p-10 text-center">
            <Network className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <div className="font-orbitron font-bold text-slate-300">No hierarchy charted on {biome.name} yet</div>
            <p className="font-mono text-[13px] text-slate-500 mt-1">Enemy command structures are only mapped on Char for now.</p>
          </div>
        )
      )}

      {setup && (
        <RunSetupModal
          biome={setup.biome || null}
          boss={setup.boss || null}
          target={setup.biome ? target : null}
          squad={squad}
          champions={champions}
          onClose={() => setSetup(null)}
          onOpenBarracks={onOpenBarracks}
          onLaunched={(run) => {
            setSetup(null);
            onStartCombat?.(run);
          }}
        />
      )}
    </div>
  );
}
