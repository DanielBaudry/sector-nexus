import React, { useState } from 'react';
import { Users, Shield, Zap, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function SquadBuilderView({
  squads,
  champions,
  onRefreshSquads,
}) {
  const currentSquad = squads?.[0] || { id: 'squad_alpha', name: 'Alpha Strike Team', champion_ids: [] };
  const [selectedIds, setSelectedIds] = useState(currentSquad.champion_ids || []);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  // Toggle champion in/out of squad (max 4)
  const toggleChampion = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((cid) => cid !== id));
    } else {
      if (selectedIds.length >= 4) {
        alert('Maximum squad size is 4 operatives. Deselect one first.');
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSquad(currentSquad.id, currentSquad.name, selectedIds);
      setSuccessMsg('Squad formation saved.');
      if (onRefreshSquads) onRefreshSquads();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const squadChampions = selectedIds
    .map((id) => champions?.find((c) => c.id === id))
    .filter(Boolean);

  // Faction counts
  const factionCounts = {};
  squadChampions.forEach((c) => {
    factionCounts[c.faction] = (factionCounts[c.faction] || 0) + 1;
  });
  const dominantFaction = Object.entries(factionCounts).find(([_, count]) => count >= 3);

  const totalPower = squadChampions.reduce((acc, c) => {
    const eff = c.effective_stats || c.base_stats;
    return acc + (eff.attack * 2) + eff.defense + Math.round(eff.hp * 0.3) + c.level * 25;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" />
            STRIKE TEAM FORMATION
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            CONSTRUCT A 4-OPERATIVE SQUAD // ACTIVATE FACTION SYNERGY FOR EXPEDITION BONUS
          </p>
        </div>

        <button
          disabled={saving || selectedIds.length === 0}
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'SAVING...' : 'SAVE SQUAD FORMATION'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formation Slots (4 Slots) */}
      <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400 uppercase">ACTIVE TEAM</span>
            <span className="font-mono text-xs text-cyan-400 font-bold">
              ({selectedIds.length}/4 OPERATIVES)
            </span>
          </div>

          <div className="font-mono text-xs text-amber-400 font-bold">
            TOTAL COMBAT POWER: {totalPower.toLocaleString()}
          </div>
        </div>

        {dominantFaction && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              FACTION RESONANCE ACTIVE: <strong>{dominantFaction[0]}</strong> ({dominantFaction[1]}/4) provides +15% Hull & Attack power!
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((slotIdx) => {
            const champ = squadChampions[slotIdx];
            if (!champ) {
              return (
                <div
                  key={slotIdx}
                  className="p-6 rounded-xl border border-dashed border-slate-700 bg-[#070c18] flex flex-col items-center justify-center text-center h-48"
                >
                  <span className="w-8 h-8 rounded-full bg-slate-800 text-slate-500 font-mono text-xs flex items-center justify-center font-bold mb-2">
                    {slotIdx + 1}
                  </span>
                  <span className="text-xs font-mono text-slate-500 uppercase">
                    EMPTY FORMATION SLOT
                  </span>
                  <span className="text-[10px] text-slate-600 mt-1">
                    Click operative below to assign
                  </span>
                </div>
              );
            }

            const eff = champ.effective_stats || champ.base_stats;
            return (
              <div
                key={champ.id}
                className="p-4 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0e172e] to-[#070c18] flex flex-col justify-between h-48 relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-5 h-5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center justify-center font-bold">
                      {slotIdx + 1}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {champ.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 my-1">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-cyan-500/40 bg-black shadow-md shrink-0">
                      <img
                        src={`/assets/characters/${
                          champ.name.includes('Raynor') ? 'raynor' :
                          champ.name.includes('Nova') ? 'nova' :
                          champ.name.includes('Kerrigan') ? 'kerrigan' :
                          champ.name.includes('Artanis') ? 'artanis' :
                          champ.name.includes('Lisa') ? 'medic' : 'raynor'
                        }.svg`}
                        alt={champ.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-100 truncate">{champ.name}</h4>
                      <span className="text-[10px] font-mono text-slate-400 block truncate">
                        {champ.faction}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center pt-2 border-t border-slate-800">
                  <div className="bg-slate-900/60 rounded p-1">
                    <span className="text-slate-500 block text-[8px]">HP</span>
                    <span className="text-emerald-400 font-bold">{eff.max_hp}</span>
                  </div>
                  <div className="bg-slate-900/60 rounded p-1">
                    <span className="text-slate-500 block text-[8px]">ATK</span>
                    <span className="text-amber-400 font-bold">{eff.attack}</span>
                  </div>
                  <div className="bg-slate-900/60 rounded p-1">
                    <span className="text-slate-500 block text-[8px]">SPD</span>
                    <span className="text-cyan-400 font-bold">{eff.speed}</span>
                  </div>
                </div>

                <button
                  onClick={() => toggleChampion(champ.id)}
                  className="mt-2 py-1 rounded bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 text-[10px] font-mono border border-slate-700 transition"
                >
                  REMOVE FROM SQUAD
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Operatives Roster Grid */}
      <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20">
        <h3 className="font-orbitron font-bold text-base text-slate-100 mb-3">
          SELECT FROM AVAILABLE OPERATIVES ({champions?.length || 0})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {champions?.map((champ) => {
            const isAssigned = selectedIds.includes(champ.id);
            return (
              <button
                key={champ.id}
                onClick={() => toggleChampion(champ.id)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  isAssigned
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/20'
                    : 'border-slate-800 bg-[#070c18] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-cyan-500/40 bg-black shadow-md shrink-0">
                    <img
                      src={`/assets/characters/${
                        champ.name.includes('Raynor') ? 'raynor' :
                        champ.name.includes('Nova') ? 'nova' :
                        champ.name.includes('Kerrigan') ? 'kerrigan' :
                        champ.name.includes('Artanis') ? 'artanis' :
                        champ.name.includes('Lisa') ? 'medic' : 'raynor'
                      }.svg`}
                      alt={champ.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-100 truncate">{champ.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      {champ.role} // LVL {champ.level}
                    </span>
                  </div>
                </div>

                <div>
                  {isAssigned ? (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500 text-black font-bold">
                      IN SQUAD
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      BENCH
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
