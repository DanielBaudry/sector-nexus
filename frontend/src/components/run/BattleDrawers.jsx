import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Gem, Sparkles, Package, Crosshair, X } from 'lucide-react';
import ArtifactCard from '../ArtifactCard';
import RunNodeMap from './RunNodeMap';
import { HeroLootList } from './HeroLoot';

/** Battle log, newest first, with kills / alerts / wins highlighted. */
export function LogFeed({ log = [] }) {
  const lines = [...log].reverse().slice(0, 60);
  if (!lines.length) return <div className="font-mono text-[13px] text-slate-500">Nothing yet.</div>;
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => (
        <div
          key={log.length - i}
          className={`font-mono text-[13px] leading-snug border-l-2 pl-2 ${
            i === 0 ? 'text-slate-100 border-cyan-400' : i < 5 ? 'text-slate-300 border-slate-600' : 'text-slate-500 border-slate-800'
          } ${line.includes('💀') ? '!text-red-400' : ''} ${line.includes('🚨') ? '!text-amber-300' : ''} ${line.includes('🏆') ? '!text-emerald-300' : ''}`}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/** The expedition route, read-only (where you are, what is ahead). */
export function RouteMap({ run }) {
  return (
    <div className="h-[min(620px,70vh)]">
      <RunNodeMap nodes={run.nodes} currentNodeId={run.current_node_id} reachableIds={[]} busy onChoose={() => {}} />
    </div>
  );
}

/** Full artifact sheet over everything (click an artifact in a loot list). */
export function ArtifactDetail({ artifact, onClose }) {
  useEffect(() => {
    if (!artifact) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artifact, onClose]);
  if (!artifact) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="panel-enter w-full max-w-sm relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-500 flex items-center justify-center hover:bg-slate-700" title="Close [Esc]">
          <X className="w-4 h-4 text-slate-200" />
        </button>
        <div className="font-mono text-[11px] tracking-[0.3em] text-slate-400 mb-1.5">ARTIFACT · {artifact.rarity?.toUpperCase()}</div>
        <ArtifactCard artifact={artifact} />
        {artifact.set_type && <div className="mt-2 font-mono text-[12px] text-slate-400">Set: <span className="text-slate-200">{artifact.set_type}</span></div>}
      </div>
    </div>,
    document.body,
  );
}

/** Loot and rewards gathered so far on this run. Artifacts open their full sheet on click. */
export function LootSummary({ run, onArtifact }) {
  const r = run.rewards || {};
  const rows = [
    { icon: Coins, label: 'Credits', value: r.credits, color: 'text-amber-300' },
    { icon: Gem, label: 'Crystals', value: r.crystals, color: 'text-cyan-300' },
    { icon: Sparkles, label: 'Champion XP', value: r.champion_xp, color: 'text-purple-300' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {rows.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/40 p-2 text-center">
            <Icon className={`w-5 h-5 mx-auto ${color}`} />
            <div className={`font-orbitron font-black text-lg ${color}`}>{(value || 0).toLocaleString()}</div>
            <div className="font-mono text-[11px] text-slate-500 uppercase">{label}</div>
          </div>
        ))}
      </div>
      {run.influence && (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 flex items-start gap-2 font-mono text-[13px] text-cyan-100">
          <Crosshair className="w-4 h-4 mt-0.5 shrink-0" />
          <span>+{run.influence.gained} Influence on <b>{run.influence.target_name}</b><span className="block text-[12px] text-slate-400">Banked when the run ends</span></span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[12px] tracking-widest text-slate-400 mb-2">
          <Package className="w-3.5 h-3.5" /> ARTIFACTS ({r.artifacts?.length || 0})
        </div>
        {r.artifacts?.length ? (
          <div className="grid grid-cols-1 gap-1.5">
            {r.artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} compact onClick={onArtifact ? () => onArtifact(a) : undefined} />)}
          </div>
        ) : (
          <div className="font-mono text-[13px] text-slate-500">No artifacts recovered yet.</div>
        )}
      </div>
      <HeroLootList rewards={r} names={run.hero_names} title="Warp Beacon data" />
      <p className="font-mono text-[12px] text-slate-500">Extracting early keeps half of everything above.</p>
    </div>
  );
}
