import React, { useState } from 'react';
import { Shield, Zap, Sparkles, ChevronRight, Plus, Trash2, ArrowUpCircle, Check } from 'lucide-react';
import { api } from '../services/api';

const SLOTS = ['Weapon', 'Armor', 'Helmet', 'Boots', 'Neural Implant', 'Power Core'];

const CONDITIONS = [
  { value: 'always', label: 'Default: Always Trigger' },
  { value: 'ally_hp_under_50', label: 'Condition: If Ally HP < 50%' },
  { value: 'self_shield_depleted', label: 'Condition: If Self Shields Depleted' },
  { value: 'enemy_is_elite', label: 'Condition: If Enemy is Elite or Boss' },
  { value: 'enemy_count_over_1', label: 'Condition: If Multiple Hostiles (>1)' },
  { value: 'enemy_low_hp', label: 'Condition: If Enemy Hull Critical (<30%)' },
];

export default function ArmoryView({
  champions,
  artifacts,
  player,
  onRefreshChampions,
  onRefreshArtifacts,
  onRefreshPlayer,
}) {
  const [selectedChampionId, setSelectedChampionId] = useState(champions?.[0]?.id);
  const [factionFilter, setFactionFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('gear'); // 'gear' or 'gambits'
  const [selectedSlotForEquip, setSelectedSlotForEquip] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const selectedChamp = champions?.find((c) => c.id === selectedChampionId) || champions?.[0];

  const filteredChampions = champions?.filter((c) => {
    if (factionFilter === 'ALL') return true;
    return c.faction === factionFilter;
  });

  // Calculate equipped artifact objects for selected champion
  const equippedArtifactsBySlot = {};
  if (selectedChamp && artifacts) {
    Object.entries(selectedChamp.equipped_artifact_ids || {}).forEach(([slot, artId]) => {
      const art = artifacts.find((a) => a.id === artId);
      if (art) equippedArtifactsBySlot[slot] = art;
    });
  }

  // Handle Equipping Artifact
  const handleEquip = async (artifactId) => {
    try {
      await api.equipArtifact(selectedChamp.id, artifactId);
      setSelectedSlotForEquip(null);
      setFeedbackMsg('Artifact successfully equipped.');
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshArtifacts) onRefreshArtifacts();
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Unequipping Artifact
  const handleUnequip = async (slot) => {
    try {
      await api.unequipArtifact(selectedChamp.id, slot);
      setFeedbackMsg(`Artifact removed from ${slot}.`);
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshArtifacts) onRefreshArtifacts();
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Upgrading Artifact
  const handleUpgrade = async (artifactId) => {
    try {
      const res = await api.upgradeArtifact(artifactId);
      setFeedbackMsg(`Artifact upgraded to Level ${res.artifact.level}!`);
      if (onRefreshArtifacts) onRefreshArtifacts();
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshPlayer) onRefreshPlayer(res.player);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Updating Gambits
  const handleGambitChange = async (index, field, value) => {
    const updatedGambits = [...selectedChamp.gambits];
    updatedGambits[index] = { ...updatedGambits[index], [field]: value };

    try {
      await api.updateGambits(selectedChamp.id, updatedGambits);
      setFeedbackMsg('AI Gambit rules updated.');
      if (onRefreshChampions) onRefreshChampions();
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err) {
      alert(err.message);
    }
  };

  const eff = selectedChamp?.effective_stats || selectedChamp?.base_stats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Roster Column (4 cols) */}
      <div className="lg:col-span-4 hud-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col h-[750px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            OPERATIVES ({filteredChampions?.length || 0})
          </h3>
          <span className="text-[10px] font-mono text-cyan-400 uppercase">
            ROSTER
          </span>
        </div>

        {/* Faction Filter Buttons */}
        <div className="grid grid-cols-4 gap-1 my-3 text-[10px] font-mono">
          {['ALL', 'Terran Vanguard', 'Bio-Swarm', 'Astral Templars'].map((f) => (
            <button
              key={f}
              onClick={() => setFactionFilter(f)}
              className={`py-1 rounded text-center truncate ${
                factionFilter === f
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL' ? 'ALL' : f.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Champion Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredChampions?.map((c) => {
            const isSelected = selectedChamp?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChampionId(c.id)}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-[#080d1a] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-cyan-500/40 bg-black shadow-md shrink-0">
                    <img
                      src={`/assets/characters/${
                        c.name.includes('Raynor') ? 'raynor' :
                        c.name.includes('Nova') ? 'nova' :
                        c.name.includes('Kerrigan') ? 'kerrigan' :
                        c.name.includes('Artanis') ? 'artanis' :
                        c.name.includes('Lisa') ? 'medic' : 'raynor'
                      }.svg`}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      {c.role} // LVL {c.level}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      c.rarity === 'Legendary'
                        ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                        : c.rarity === 'Epic'
                        ? 'bg-purple-950 text-purple-400 border border-purple-500/40'
                        : 'bg-cyan-950 text-cyan-400 border border-cyan-500/40'
                    }`}
                  >
                    {c.rarity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Operative Inspector (8 cols) */}
      {selectedChamp && (
        <div className="lg:col-span-8 space-y-4">
          {feedbackMsg && (
            <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-cyan-400" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Champion Profile Card */}
          <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-cyan-400 bg-black shadow-xl shrink-0">
                  <img
                    src={`/assets/characters/${
                      selectedChamp.name.includes('Raynor') ? 'raynor' :
                      selectedChamp.name.includes('Nova') ? 'nova' :
                      selectedChamp.name.includes('Kerrigan') ? 'kerrigan' :
                      selectedChamp.name.includes('Artanis') ? 'artanis' :
                      selectedChamp.name.includes('Lisa') ? 'medic' : 'raynor'
                    }.svg`}
                    alt={selectedChamp.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-orbitron font-black text-xl text-slate-100">
                      {selectedChamp.name}
                    </h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      LVL {selectedChamp.level}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {selectedChamp.title} — {selectedChamp.faction} ({selectedChamp.role})
                  </p>
                </div>
              </div>

              {/* Rarity Tag */}
              <span className="font-mono text-xs uppercase px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold">
                {selectedChamp.rarity} TACTICAL SPEC
              </span>
            </div>

            {/* Effective Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-5 pt-4 border-t border-slate-800/80 text-center font-mono text-xs">
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">HULL HP</span>
                <span className="text-emerald-400 font-bold text-sm">{eff?.max_hp}</span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">SHIELDS</span>
                <span className="text-cyan-400 font-bold text-sm">{eff?.max_shields}</span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ATTACK</span>
                <span className="text-amber-400 font-bold text-sm">{eff?.attack}</span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">DEFENSE</span>
                <span className="text-blue-400 font-bold text-sm">{eff?.defense}</span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">SPEED</span>
                <span className="text-cyan-300 font-bold text-sm">{eff?.speed}</span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CRIT RATE</span>
                <span className="text-purple-400 font-bold text-sm">
                  {Math.round((eff?.crit_rate || 0.15) * 100)}%
                </span>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CRIT MULT</span>
                <span className="text-purple-300 font-bold text-sm">
                  {eff?.crit_damage || 1.5}x
                </span>
              </div>
            </div>
          </div>

          {/* Subtabs: Gear vs AI Gambits */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('gear')}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs uppercase font-bold transition ${
                activeTab === 'gear'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Modular Gear Grid (6 Slots)
            </button>
            <button
              onClick={() => setActiveTab('gambits')}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs uppercase font-bold transition ${
                activeTab === 'gambits'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Gambit Behavior Rules
            </button>
          </div>

          {/* Tab 1: Gear Grid */}
          {activeTab === 'gear' && (
            <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20 space-y-4">
              <h4 className="font-orbitron font-bold text-sm text-slate-100">
                EQUIPPED ARTIFACTS & MODULES
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {SLOTS.map((slot) => {
                  const equipped = equippedArtifactsBySlot[slot];
                  return (
                    <div
                      key={slot}
                      className="p-3 rounded-xl border border-slate-800 bg-[#070c18] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                        <span className="uppercase">{slot}</span>
                        {equipped && (
                          <span className="text-cyan-400 font-bold">LVL {equipped.level}</span>
                        )}
                      </div>

                      {equipped ? (
                        <div>
                          <h5 className="font-bold text-xs text-slate-100 line-clamp-1">{equipped.name}</h5>
                          <span className="text-[10px] font-mono text-cyan-300 block">
                            +{equipped.main_stat_value} {equipped.main_stat_name.toUpperCase()}
                          </span>
                          <span className="text-[9px] font-mono text-amber-400 block">
                            Set: {equipped.set_type}
                          </span>

                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
                            <button
                              onClick={() => handleUpgrade(equipped.id)}
                              className="flex-1 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-mono text-[10px] flex items-center justify-center gap-1"
                            >
                              <ArrowUpCircle className="w-3 h-3" />
                              <span>UPGRADE ({equipped.level * 1500} Cr)</span>
                            </button>
                            <button
                              onClick={() => handleUnequip(slot)}
                              className="p-1 rounded bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700"
                              title="Unequip"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <button
                            onClick={() => setSelectedSlotForEquip(slot)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-dashed border-slate-600 text-slate-400 hover:text-cyan-300 text-xs font-mono inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Equip {slot}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal for selecting an artifact to equip */}
              {selectedSlotForEquip && (
                <div className="p-4 rounded-xl border border-cyan-400 bg-cyan-950/40 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-cyan-300 uppercase font-bold">
                      SELECT ARTIFACT FOR {selectedSlotForEquip}
                    </span>
                    <button
                      onClick={() => setSelectedSlotForEquip(null)}
                      className="text-xs font-mono text-slate-400 hover:text-white"
                    >
                      CANCEL
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {artifacts
                      ?.filter((a) => a.slot === selectedSlotForEquip)
                      .map((art) => (
                        <button
                          key={art.id}
                          onClick={() => handleEquip(art.id)}
                          className="p-2.5 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-400 text-left font-mono text-xs transition"
                        >
                          <div className="font-bold text-slate-100">{art.name}</div>
                          <div className="text-[10px] text-cyan-400">
                            +{art.main_stat_value} {art.main_stat_name} (Set: {art.set_type})
                          </div>
                        </button>
                      ))}
                    {artifacts?.filter((a) => a.slot === selectedSlotForEquip).length === 0 && (
                      <span className="text-xs font-mono text-slate-400 col-span-3 py-2 text-center">
                        No artifacts available for this slot. Farm expeditions or summon to acquire more.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: AI Gambits */}
          {activeTab === 'gambits' && (
            <div className="hud-panel rounded-2xl p-5 border border-cyan-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-orbitron font-bold text-sm text-slate-100">
                    AUTOMATED AI GAMBIT BEHAVIORS
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Evaluated in order of priority when timer expires or during background expeditions.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedChamp.gambits?.map((gambit, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-800 bg-[#070c18] flex flex-wrap items-center gap-3 font-mono text-xs"
                  >
                    <span className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>

                    {/* Condition Dropdown */}
                    <select
                      value={gambit.condition}
                      onChange={(e) => handleGambitChange(idx, 'condition', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 flex-1 min-w-[200px]"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <ChevronRight className="w-4 h-4 text-slate-500" />

                    {/* Action Card Dropdown */}
                    <select
                      value={gambit.card_id}
                      onChange={(e) => handleGambitChange(idx, 'card_id', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 min-w-[180px]"
                    >
                      {selectedChamp.cards?.map((card) => (
                        <option key={card.id} value={card.id}>
                          Action: {card.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
