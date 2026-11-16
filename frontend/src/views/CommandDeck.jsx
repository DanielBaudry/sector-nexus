import React from 'react';
import { Shield, Sparkles, Compass, Users, Swords, Satellite, ArrowRight, Zap, Target } from 'lucide-react';

export default function CommandDeck({
  player,
  squads,
  champions,
  activeExpedition,
  backgroundExpeditions,
  setActiveTab,
}) {
  const currentSquad = squads?.[0] || { champion_ids: [] };
  const squadChampions = (currentSquad.champion_ids || [])
    .map((id) => champions?.find((c) => c.id === id))
    .filter(Boolean);

  // Compute faction synergy
  const factionCounts = {};
  squadChampions.forEach((c) => {
    factionCounts[c.faction] = (factionCounts[c.faction] || 0) + 1;
  });

  const dominantFaction = Object.entries(factionCounts).find(([_, count]) => count >= 3);
  const synergyActive = !!dominantFaction;

  // Calculate total power
  const totalPower = squadChampions.reduce((acc, c) => {
    const eff = c.effective_stats || c.base_stats;
    return acc + (eff.attack * 2) + eff.defense + Math.round(eff.hp * 0.3) + c.level * 25;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#0b1426] via-[#091020] to-[#0d162d] p-6 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2 font-mono text-xs text-cyan-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            SECTOR STATUS // DEFCON 2
          </div>
          <h2 className="font-orbitron font-black text-2xl sm:text-3xl text-slate-100 tracking-wide">
            WELCOME ABOARD, <span className="text-cyan-400">{player?.username.toUpperCase()}</span>
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Form your elite strike teams with <span className="text-cyan-300">Terran Vanguard</span>,{' '}
            <span className="text-purple-300">Bio-Swarm</span>, and{' '}
            <span className="text-amber-300">Astral Templars</span>. Deploy on real-time timed card expeditions or dispatch orbital AI gambits to farm rare artifacts.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => setActiveTab('expeditions')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition"
            >
              <Compass className="w-4 h-4" />
              <span>Deploy Expedition</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('gacha')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 font-orbitron font-bold text-xs uppercase tracking-wider transition"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Warp Invocations</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Active Strike Team & Synergy Card */}
      <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="font-orbitron font-bold text-lg text-slate-100">
              {currentSquad.name || 'Alpha Strike Team'}
            </h3>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              POWER: {totalPower.toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => setActiveTab('squad')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Edit Squad Formation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Synergy Alert */}
        {synergyActive && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              FACTION RESONANCE ACTIVE: <strong>{dominantFaction[0]}</strong> ({dominantFaction[1]}/4) provides +15% Hull & Attack power!
            </span>
          </div>
        )}

        {/* Champion Formation Grid — image-first portrait cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {squadChampions.map((champ, idx) => {
            const eff = champ.effective_stats || champ.base_stats;
            const portrait = champ.name.includes('Raynor') ? '/assets/characters/raynor.jpg'
              : champ.name.includes('Nova')     ? '/assets/characters/nova.jpg'
              : champ.name.includes('Kerrigan') ? '/assets/characters/kerrigan.jpg'
              : champ.name.includes('Zeratul')  ? '/assets/characters/zeratul.jpg'
              : champ.name.includes('Artanis')  ? '/assets/characters/artanis.svg'
              : champ.name.includes('Lisa')     ? '/assets/characters/medic.svg'
              : '/assets/characters/raynor.jpg';
            const factionColor = champ.faction?.includes('Terran') ? 'border-blue-400/50'
              : champ.faction?.includes('Bio')    ? 'border-purple-400/50'
              : 'border-amber-400/50';
            return (
              <div
                key={champ.id}
                className={`relative rounded-xl border ${factionColor} bg-[#080e1c] overflow-hidden flex flex-col hover:brightness-110 transition group cursor-default`}
              >
                {/* BIG portrait */}
                <div className="relative h-44 overflow-hidden bg-black">
                  <img
                    src={portrait}
                    alt={champ.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  {/* Position badge */}
                  <span className="absolute top-2 right-2 font-mono text-[9px] px-1.5 py-px rounded bg-black/70 text-slate-300 border border-slate-700">
                    POS {idx + 1}
                  </span>
                  {/* Name overlaid at bottom of image */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <h4 className="font-orbitron font-bold text-sm text-slate-100 truncate leading-tight drop-shadow-md">
                      {champ.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">{champ.title}</span>
                  </div>
                </div>

                {/* Stat row */}
                <div className="grid grid-cols-3 gap-px bg-slate-800/40 text-[11px] font-mono text-center">
                  <div className="bg-[#080e1c] p-1.5">
                    <span className="text-slate-500 block text-[8px]">HP</span>
                    <span className="text-emerald-400 font-bold">{eff.max_hp}</span>
                  </div>
                  <div className="bg-[#080e1c] p-1.5">
                    <span className="text-slate-500 block text-[8px]">ATK</span>
                    <span className="text-amber-400 font-bold">{eff.attack}</span>
                  </div>
                  <div className="bg-[#080e1c] p-1.5">
                    <span className="text-slate-500 block text-[8px]">SPD</span>
                    <span className="text-cyan-400 font-bold">{eff.speed}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Quick Monitors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Combat Monitor */}
        <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-red-400" />
                LIVE EXPEDITION STATUS
              </span>
              {activeExpedition && activeExpedition.status === 'IN_PROGRESS' ? (
                <span className="font-mono text-xs text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded animate-pulse">
                  ENGAGED
                </span>
              ) : (
                <span className="font-mono text-xs text-slate-500">STANDBY</span>
              )}
            </div>

            <h4 className="font-orbitron font-bold text-base text-slate-100">
              {activeExpedition ? activeExpedition.biome_name : 'No Active Combat Mission'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {activeExpedition && activeExpedition.status === 'IN_PROGRESS'
                ? `Room ${activeExpedition.room_index + 1}/${activeExpedition.total_rooms} in progress. Real-time tactical cards active.`
                : 'Deploy to Char, Aiur, Mar Sara, or the Derelict Void Sector to test your squad and AI gambits.'}
            </p>
          </div>

          <button
            onClick={() => setActiveTab(activeExpedition ? 'combat' : 'expeditions')}
            className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition flex items-center justify-center gap-1.5"
          >
            <span>{activeExpedition ? 'Return to Tactical Combat' : 'Open Sector Map'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Orbital Background Missions */}
        <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                <Satellite className="w-4 h-4 text-cyan-400" />
                ORBITAL BACKGROUND FARMING
              </span>
              <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                {backgroundExpeditions?.length || 0} DEPLOYED
              </span>
            </div>

            <h4 className="font-orbitron font-bold text-base text-slate-100">
              Passive Resource Gathering
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Squads dispatched into orbit automatically harvest crystals, credits, and gear over time using their preset AI behaviors.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('idle')}
            className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition flex items-center justify-center gap-1.5"
          >
            <span>Check Orbital Missions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
