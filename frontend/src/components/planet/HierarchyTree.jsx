import React from 'react';
import { Crosshair } from 'lucide-react';
import { AdaptationPips, ChampionArt, InfluenceBar, RANK_LABEL, STATUS_META, StatusBadge } from './hierarchyUi';

function ChampionNode({ champion, selected, targeted, onSelect }) {
  const meta = STATUS_META[champion.status];
  const overlord = champion.rank === 'OVERLORD';
  const { influence } = champion.standing;
  return (
    <button
      onClick={() => onSelect(champion.id)}
      className={`relative text-left rounded-xl border-2 overflow-hidden bg-black/70 transition-all hover:-translate-y-0.5 ${
        overlord ? 'w-52' : 'w-40'
      } ${selected ? 'ring-2 ring-offset-2 ring-offset-[#050811]' : ''}`}
      style={{
        borderColor: selected ? meta.color : `${meta.color}66`,
        boxShadow: champion.status === 'VULNERABLE' ? `0 0 22px ${meta.color}55` : undefined,
        '--tw-ring-color': meta.color,
      }}
    >
      <div className="relative h-24 flex items-center justify-center"
        style={{ background: `radial-gradient(ellipse at 50% 60%, ${champion.color}33, transparent 70%)` }}>
        <ChampionArt champion={champion} className="h-full w-full object-contain p-1" />
        {targeted && (
          <span className="absolute top-1 right-1 flex items-center gap-0.5 px-1 rounded bg-cyan-500 text-black font-mono text-[10px] font-black animate-pulse">
            <Crosshair className="w-3 h-3" /> TARGET
          </span>
        )}
        <span className="absolute top-1 left-1 font-mono text-[10px] px-1 rounded bg-black/80 text-slate-300 border border-slate-700">
          {RANK_LABEL[champion.rank]?.toUpperCase()}
        </span>
      </div>
      <div className="px-2 py-1.5 space-y-1 border-t border-white/10 bg-gradient-to-b from-slate-900 to-black">
        <div className="flex items-center justify-between gap-1">
          <span className="font-orbitron font-black text-sm text-slate-100 truncate">{champion.name}</span>
          <AdaptationPips losses={champion.standing.losses} />
        </div>
        <div className="font-mono text-[11px] text-slate-400 truncate">{champion.title}</div>
        <StatusBadge status={champion.status} />
        {champion.status !== 'DEFEATED' && champion.status !== 'LOCKED' && (
          <InfluenceBar value={influence} max={champion.influence_required} height="h-1.5" />
        )}
      </div>
    </button>
  );
}

/** Line colour: gold once the lower champion has fallen (the path is open). */
const lineColor = (child) => (child.status === 'DEFEATED' ? 'bg-amber-400/80' : 'bg-slate-600');

function Branch({ champion, byParent, ...rest }) {
  const kids = byParent[champion.id] || [];
  return (
    <div className="flex flex-col items-center">
      <ChampionNode champion={champion} targeted={rest.targetId === champion.id} selected={rest.selectedId === champion.id} onSelect={rest.onSelect} />
      {kids.length > 0 && (
        <>
          <div className={`w-0.5 h-5 ${kids.some((k) => k.status === 'DEFEATED') ? 'bg-amber-400/80' : 'bg-slate-600'}`} />
          <div className="flex">
            {kids.map((k, i) => (
              <div key={k.id} className="relative flex flex-col items-center px-2 sm:px-3">
                <div className="absolute top-0 inset-x-0 flex">
                  <div className={`h-0.5 flex-1 ${i > 0 ? lineColor(k) : ''}`} />
                  <div className={`h-0.5 flex-1 ${i < kids.length - 1 ? lineColor(k) : ''}`} />
                </div>
                <div className={`w-0.5 h-5 ${lineColor(k)}`} />
                <Branch champion={k} byParent={byParent} {...rest} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Org-chart of a planet's enemy hierarchy, overlord at the top. */
export default function HierarchyTree({ champions, targetId, selectedId, onSelect }) {
  const byParent = {};
  champions.forEach((c) => {
    if (c.superior_id) (byParent[c.superior_id] ||= []).push(c);
  });
  const roots = champions.filter((c) => !c.superior_id);
  return (
    <div className="overflow-x-auto py-2">
      <div className="min-w-fit mx-auto flex justify-center gap-8">
        {roots.map((r) => (
          <Branch key={r.id} champion={r} byParent={byParent} targetId={targetId} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
