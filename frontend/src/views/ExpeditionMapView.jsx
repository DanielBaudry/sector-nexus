import React, { useState } from 'react';
import { Compass, Flame, Sparkles, Radio, Swords, Satellite, AlertTriangle, Shield, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import RunSetupModal from '../components/run/RunSetupModal';

const ICON_MAP = {
  Flame,
  Sparkles,
  Compass,
  Radio,
};

export default function ExpeditionMapView({
  biomes,
  squads,
  champions = [],
  activeRun,
  onStartCombat,
  onDispatchIdle,
}) {
  const [starting, setStarting] = useState(false);
  const [setupBiome, setSetupBiome] = useState(null);
  const currentSquad = squads?.[0] || { id: 'squad_alpha' };
  const runInProgress = activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);

  const handleStartLive = (biome) => {
    if (runInProgress) {
      if (onStartCombat) onStartCombat(activeRun);
      return;
    }
    setSetupBiome(biome);
  };

  const handleDispatchBackground = async (biomeId) => {
    setStarting(true);
    try {
      await api.dispatchBackground(biomeId, currentSquad.id, 60);
      if (onDispatchIdle) onDispatchIdle();
    } catch (err) {
      alert(err.message || 'Failed to dispatch background expedition');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
          <Compass className="w-6 h-6 text-cyan-400" />
          PLANETARY EXPEDITION SECTORS
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-0.5">
          DEPLOY SQUADS INTO HIGH-THREAT BIOMES FOR LIVE TACTICAL COMBAT OR BACKGROUND ORBITAL HARVESTING
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {biomes?.map((biome) => {
          const Icon = ICON_MAP[biome.icon_name] || Compass;

          return (
            <div
              key={biome.id}
              className={`relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br ${biome.bg_gradient} p-6 shadow-xl flex flex-col justify-between`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-white/20"
                      style={{ backgroundColor: biome.color }}
                    >
                      <Icon className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <h3 className="font-orbitron font-black text-lg text-slate-100">
                        {biome.name}
                      </h3>
                      <span className="text-[10px] font-mono text-cyan-300 block">
                        REC POWER: {biome.recommended_power}
                      </span>
                      {biome.max_difficulty > 1 && (
                        <span className="mt-0.5 inline-block px-1.5 py-px rounded bg-red-950/60 text-red-300 border border-red-500/40 text-[9px] font-mono">
                          DIFFICULTY 1–{biome.max_difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  {biome.description}
                </p>

                {/* Planetary Hazard */}
                <div className="mt-4 p-2.5 rounded-lg bg-black/40 border border-slate-700/80 text-[11px] font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-amber-300 font-bold uppercase block">
                      Hazard: {biome.hazard_name}
                    </span>
                    <span className="text-slate-400">{biome.hazard_description}</span>
                  </div>
                </div>

                {/* Drop Gear Sets */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                  <span className="text-slate-400 uppercase">ARTIFACT DROPS:</span>
                  {biome.allowed_artifact_sets?.map((set) => (
                    <span
                      key={set}
                      className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30"
                    >
                      {set}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-700/60 flex flex-wrap gap-2.5">
                <button
                  disabled={starting}
                  onClick={() => handleStartLive(biome)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Swords className="w-4 h-4" />
                  <span>{runInProgress ? (activeRun.biome_id === biome.id ? 'RESUME DESCENT' : 'RUN IN PROGRESS') : 'LIVE DESCENT'}</span>
                </button>

                <button
                  disabled={starting}
                  onClick={() => handleDispatchBackground(biome.id)}
                  className="py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-orbitron font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  <span>ORBITAL IDLE (60s)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {setupBiome && (
        <RunSetupModal
          biome={setupBiome}
          squad={currentSquad}
          champions={champions}
          onClose={() => setSetupBiome(null)}
          onLaunched={(run) => {
            setSetupBiome(null);
            if (onStartCombat) onStartCombat(run);
          }}
        />
      )}
    </div>
  );
}
