import React, { useEffect, useState } from 'react';
import { Compass, AlertTriangle, ArrowRight, Crosshair, Crown, Network } from 'lucide-react';
import { api } from '../services/api';
import PlanetView, { PLANET_ICONS } from './PlanetView';

/** Sector Map: pick a planet. Each planet opens its own page (expeditions + enemy hierarchy). */
export default function ExpeditionMapView({ biomes, squads, champions = [], activeRun, onStartCombat }) {
  const [planetId, setPlanetId] = useState(null);
  const [hierarchies, setHierarchies] = useState({});
  const currentSquad = squads?.[0] || { id: 'squad_alpha' };
  const runInProgress = activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);

  useEffect(() => {
    if (planetId) return;
    (biomes || []).forEach((b) => {
      api.getHierarchy(b.id).then((h) => setHierarchies((prev) => ({ ...prev, [b.id]: h }))).catch(() => {});
    });
  }, [biomes, planetId]);

  const planet = biomes?.find((b) => b.id === planetId);
  if (planet) {
    return (
      <PlanetView
        biome={planet}
        squad={currentSquad}
        champions={champions}
        activeRun={activeRun}
        onBack={() => setPlanetId(null)}
        onStartCombat={onStartCombat}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
          <Compass className="w-6 h-6 text-cyan-400" />
          PLANETARY EXPEDITION SECTORS
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-0.5">
          CHOOSE A PLANET · RUN EXPEDITIONS · HUNT ITS COMMAND HIERARCHY
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {biomes?.map((biome) => {
          const Icon = PLANET_ICONS[biome.icon_name] || Compass;
          const h = hierarchies[biome.id];
          const champs = h?.champions || [];
          const fallen = champs.filter((c) => c.status === 'DEFEATED').length;
          const target = champs.find((c) => c.id === h?.target_id);
          const here = runInProgress && activeRun.biome_id === biome.id;
          return (
            <button
              key={biome.id}
              onClick={() => setPlanetId(biome.id)}
              className={`group text-left relative overflow-hidden rounded-2xl border border-cyan-500/30 hover:border-cyan-300 bg-gradient-to-br ${biome.bg_gradient} p-6 shadow-xl flex flex-col gap-4 transition hover:-translate-y-0.5`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/20" style={{ backgroundColor: biome.color }}>
                  <Icon className="w-6 h-6 text-black" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-orbitron font-black text-xl text-slate-100">{biome.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-0.5 font-mono text-[12px]">
                    <span className="text-cyan-300">REC POWER {biome.recommended_power}</span>
                    {biome.max_difficulty > 1 && (
                      <span className="px-1.5 rounded bg-red-950/60 text-red-300 border border-red-500/40">DIFFICULTY 1–{biome.max_difficulty}</span>
                    )}
                    {here && <span className="px-1.5 rounded bg-red-600 text-white animate-pulse">RUN IN PROGRESS</span>}
                  </div>
                </div>
                <ArrowRight className="ml-auto w-5 h-5 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-1 transition" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{biome.description}</p>

              <div className="p-2.5 rounded-lg bg-black/40 border border-slate-700/80 text-[13px] font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><span className="text-amber-300 font-bold uppercase">{biome.hazard_name}</span> <span className="text-slate-400">— {biome.hazard_description}</span></span>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-2 font-mono text-[12px]">
                {champs.length ? (
                  <>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 border border-amber-500/40 text-amber-200">
                      <Crown className="w-3.5 h-3.5" /> HIERARCHY {fallen}/{champs.length} FALLEN
                    </span>
                    {target ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-cyan-200">
                        <Crosshair className="w-3.5 h-3.5" /> HUNTING {target.name.toUpperCase()} · {target.standing.influence}/{target.influence_required}
                      </span>
                    ) : (
                      <span className="text-slate-400">No target chosen</span>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500"><Network className="w-3.5 h-3.5" /> Hierarchy uncharted</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
