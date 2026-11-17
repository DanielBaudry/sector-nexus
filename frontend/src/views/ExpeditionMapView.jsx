import React, { useEffect, useState } from 'react';
import { Compass, Flame, Sparkles, Radio, Swords, AlertTriangle, Shield, ArrowRight, Crown, Hourglass, Coins, Gem } from 'lucide-react';
import { api } from '../services/api';
import RunSetupModal from '../components/run/RunSetupModal';

const ICON_MAP = {
  Flame,
  Sparkles,
  Compass,
  Radio,
};

function BossCard({ boss, locked, onEngage }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 bg-gradient-to-r from-[#1a0a05] via-[#120708] to-black shadow-xl"
      style={{ borderColor: `${boss.color}88`, boxShadow: `0 0 30px ${boss.color}22` }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: `radial-gradient(ellipse at 15% 50%, ${boss.color}55, transparent 60%)` }} />
      <div className="relative flex flex-col md:flex-row">
        <div className="md:w-72 shrink-0 h-56 md:h-auto flex items-center justify-center p-4">
          <img src={boss.image} alt={boss.name} className="max-h-60 w-full object-contain drop-shadow-[0_0_25px_rgba(249,115,22,0.45)]"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <div className="flex-1 p-5 md:pl-0 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="font-mono text-[12px] tracking-widest" style={{ color: boss.color }}>{boss.arena_name.toUpperCase()}</span>
              <h3 className="font-orbitron font-black text-2xl text-slate-100 leading-tight">{boss.name}</h3>
              <div className="font-orbitron text-sm text-orange-200/80">{boss.title}</div>
            </div>
            <div className="flex gap-2 font-mono text-[12px]">
              <span className="px-2 py-1 rounded bg-black/60 border border-slate-700 text-slate-300">REC POWER {boss.recommended_power}</span>
              <span className="px-2 py-1 rounded bg-red-950/60 border border-red-500/40 text-red-300">DIFFICULTY 1–{boss.max_difficulty}</span>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{boss.description}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1">PHASES</div>
              <div className="space-y-1">
                {boss.phases.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="shrink-0 w-12 text-right font-mono font-bold text-orange-300">{Math.round(p.threshold * 100)}%</span>
                    <span className="text-slate-300"><b className="font-orbitron text-slate-100">{p.name}</b> — {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1">ABILITIES</div>
              <div className="flex flex-wrap gap-1.5">
                {boss.abilities.map((a) => (
                  <span key={a.name} title={a.description}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[12px] ${
                      a.telegraph_turns ? 'border-orange-400/70 bg-orange-950/50 text-orange-200' : 'border-slate-600 bg-black/50 text-slate-300'
                    }`}>
                    {a.telegraph_turns > 0 && <Hourglass className="w-3 h-3" />}
                    {a.name}
                    <span className="text-slate-500">CD{a.cooldown_turns}</span>
                    {a.phase > 0 && <span className="text-red-300">P{a.phase + 1}</span>}
                  </span>
                ))}
              </div>
              {boss.passive && (
                <div className="mt-2 text-[12px] text-violet-200"><b>★ {boss.passive.name}</b> — {boss.passive.description}</div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 font-mono text-[13px]">
              <span className="flex items-center gap-1 text-amber-300"><Coins className="w-4 h-4" />{boss.rewards.credits?.toLocaleString()}+</span>
              <span className="flex items-center gap-1 text-cyan-300"><Gem className="w-4 h-4" />{boss.rewards.crystals}+</span>
              <span className="text-emerald-300">+ boss-grade artifacts</span>
            </div>
            <button
              onClick={onEngage}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600 text-white font-orbitron font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-900/50 flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              {locked ? 'RUN IN PROGRESS' : 'ENGAGE BOSS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpeditionMapView({
  biomes,
  squads,
  champions = [],
  activeRun,
  onStartCombat,
}) {
  const [setupBiome, setSetupBiome] = useState(null);
  const [setupBoss, setSetupBoss] = useState(null);
  const [bosses, setBosses] = useState([]);

  useEffect(() => {
    api.getBosses().then(setBosses).catch(() => setBosses([]));
  }, []);
  const currentSquad = squads?.[0] || { id: 'squad_alpha' };
  const runInProgress = activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);

  const handleStartLive = (biome) => {
    if (runInProgress) {
      if (onStartCombat) onStartCombat(activeRun);
      return;
    }
    setSetupBiome(biome);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
          <Compass className="w-6 h-6 text-cyan-400" />
          PLANETARY EXPEDITION SECTORS
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-0.5">
          DEPLOY SQUADS INTO HIGH-THREAT BIOMES FOR LIVE TACTICAL LANE COMBAT
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
                      <span className="text-[12px] font-mono text-cyan-300 block">
                        REC POWER: {biome.recommended_power}
                      </span>
                      {biome.max_difficulty > 1 && (
                        <span className="mt-0.5 inline-block px-1.5 py-px rounded bg-red-950/60 text-red-300 border border-red-500/40 text-[11px] font-mono">
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
                <div className="mt-4 p-2.5 rounded-lg bg-black/40 border border-slate-700/80 text-[13px] font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-amber-300 font-bold uppercase block">
                      Hazard: {biome.hazard_name}
                    </span>
                    <span className="text-slate-400">{biome.hazard_description}</span>
                  </div>
                </div>

                {/* Drop Gear Sets */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap font-mono text-[12px]">
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
                  onClick={() => handleStartLive(biome)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Swords className="w-4 h-4" />
                  <span>{runInProgress ? (activeRun.biome_id === biome.id ? 'RESUME DESCENT' : 'RUN IN PROGRESS') : 'LIVE DESCENT'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Boss encounters */}
      {bosses.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="font-orbitron font-black text-xl text-slate-100 flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-400" />
              BOSS ENCOUNTERS
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              ONE COLOSSAL TARGET ACROSS ALL THREE LANES · SQUAD OF 3 HEROES + TROOPS · READ ITS WIND-UPS
            </p>
          </div>
          {bosses.map((boss) => (
            <BossCard
              key={boss.id}
              boss={boss}
              locked={!!runInProgress}
              onEngage={() => (runInProgress ? onStartCombat?.(activeRun) : setSetupBoss(boss))}
            />
          ))}
        </div>
      )}

      {setupBoss && (
        <RunSetupModal
          biome={null}
          boss={setupBoss}
          squad={currentSquad}
          champions={champions}
          onClose={() => setSetupBoss(null)}
          onLaunched={(run) => {
            setSetupBoss(null);
            if (onStartCombat) onStartCombat(run);
          }}
        />
      )}

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
