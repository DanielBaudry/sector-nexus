import React from 'react';
import { FileCode2, Atom } from 'lucide-react';
import { getPortrait } from '../../utils/battleVisuals';

/** Warp Beacon loot gathered on a run: hero blueprints and print materials per hero. */
export function heroLootTotals(rewards) {
  const blueprints = rewards?.blueprints?.length || 0;
  const materials = Object.values(rewards?.hero_materials || {}).reduce((a, b) => a + b, 0);
  return { blueprints, materials };
}

export function HeroLootList({ rewards, names = {}, title }) {
  const blueprints = rewards?.blueprints || [];
  const mats = Object.entries(rewards?.hero_materials || {});
  if (!blueprints.length && !mats.length) return null;
  const name = (id) => names[id] || id;
  return (
    <div className="text-left">
      {title && <div className="font-mono text-[12px] text-slate-400 uppercase mb-1">{title}</div>}
      <div className="flex flex-wrap gap-1.5">
        {blueprints.map((id, i) => (
          <span key={`bp-${id}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-sky-400/60 bg-sky-950/50 pl-0.5 pr-2 py-0.5 font-mono text-[12px] text-sky-100">
            <img src={getPortrait(name(id))} alt="" className="w-6 h-6 rounded object-cover object-top bg-black" onError={(e) => { e.target.style.display = 'none'; }} />
            <FileCode2 className="w-3.5 h-3.5 text-sky-300" /> {name(id)} blueprint
          </span>
        ))}
        {mats.map(([id, n]) => (
          <span key={`m-${id}`} className="flex items-center gap-1.5 rounded-lg border border-teal-400/50 bg-teal-950/40 pl-0.5 pr-2 py-0.5 font-mono text-[12px] text-teal-100">
            <img src={getPortrait(name(id))} alt="" className="w-6 h-6 rounded object-cover object-top bg-black" onError={(e) => { e.target.style.display = 'none'; }} />
            <Atom className="w-3.5 h-3.5 text-teal-300" /> +{n} {name(id)}
          </span>
        ))}
      </div>
    </div>
  );
}
