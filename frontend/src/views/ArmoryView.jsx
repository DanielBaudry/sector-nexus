import React, { useMemo, useState } from 'react';
import { Shield, ChevronRight, Check, AlertTriangle, ChevronsUp, FlaskConical, X, Package, Swords, Brain, Layers, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import Stars from '../components/Stars';
import ArtifactCard from '../components/ArtifactCard';
import HeroArt from '../components/armory/HeroArt';
import HeroPortrait from '../components/armory/HeroPortrait';
import GearSlot from '../components/armory/GearSlot';
import GearPickerModal from '../components/armory/GearPickerModal';
import { SLOTS, SORTS } from '../components/armory/gear';
import { EffectSpecChips, PassiveBlock } from '../components/run/StatusEffects';
import { SKILL_IMAGES } from '../components/CardChoice';
import { SCOPE_LABEL } from '../utils/battleVisuals';

const TARGET_LABEL = {
  single_enemy: 'one enemy',
  all_enemies: 'all enemies',
  self: 'self',
  all_allies: 'all allies',
  lowest_hp_ally: 'weakest ally',
};
import { formatStat, rarityStyle, statLabel } from '../utils/progression';

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
  squads = [],
  onRefreshChampions,
  onRefreshArtifacts,
  onRefreshPlayer,
}) {
  const [selectedChampionId, setSelectedChampionId] = useState(champions?.[0]?.id);
  const [factionFilter, setFactionFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('gear'); // 'gear' | 'vault' | 'gambits'
  const [selectedSlotForEquip, setSelectedSlotForEquip] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [feedbackTone, setFeedbackTone] = useState('ok'); // 'ok' | 'warn'
  const [busy, setBusy] = useState(false);
  const [rankUpOpen, setRankUpOpen] = useState(false);
  const [fodder, setFodder] = useState([]);
  const [vaultSlot, setVaultSlot] = useState('ALL');
  const [rightTab, setRightTab] = useState('equipment'); // 'equipment' | 'abilities'

  const flash = (msg, tone = 'ok', ms = 3500) => {
    setFeedbackMsg(msg);
    setFeedbackTone(tone);
    setTimeout(() => setFeedbackMsg((m) => (m === msg ? null : m)), ms);
  };
  const championName = (id) => champions?.find((c) => c.id === id)?.name;
  const inSquad = useMemo(() => new Set(squads.flatMap((sq) => sq.champion_ids || [])), [squads]);

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
      setBusy(true);
      await api.equipArtifact(selectedChamp.id, artifactId);
      flash('Artifact equipped.');
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshArtifacts) onRefreshArtifacts();
    } catch (err) {
      flash(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  // Handle Unequipping Artifact
  const handleUnequip = async (slot) => {
    try {
      setBusy(true);
      await api.unequipArtifact(selectedChamp.id, slot);
      flash(`Artifact removed from ${slot}.`);
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshArtifacts) onRefreshArtifacts();
    } catch (err) {
      flash(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  // Handle Upgrading Artifact
  const handleUpgrade = async (artifactId) => {
    try {
      setBusy(true);
      const res = await api.upgradeArtifact(artifactId);
      const r = res.result;
      if (r.success) {
        const sub = r.substat
          ? ` ${r.substat.kind === 'added' ? 'New substat' : 'Boosted'}: ${statLabel(r.substat.stat)} ${formatStat(r.substat.stat, r.substat.value)}.`
          : '';
        flash(`Upgrade success → +${r.level}.${sub}`);
      } else {
        flash(`Upgrade failed — stays at +${r.level}. ${r.cost.toLocaleString()} Cr spent.`, 'warn');
      }
      if (onRefreshArtifacts) onRefreshArtifacts();
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshPlayer) onRefreshPlayer(res.player);
    } catch (err) {
      flash(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  // Spend XP capsules: one level, or as much as the rank cap allows
  const handleFeed = async (amount) => {
    try {
      setBusy(true);
      const res = await api.feedChampionXP(selectedChamp.id, amount);
      flash(`${res.champion.name}: +${res.xp_used.toLocaleString()} XP → level ${res.champion.level}/${res.champion.max_level}.`);
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshPlayer) onRefreshPlayer(res.player);
    } catch (err) {
      flash(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  const handleRankUp = async () => {
    try {
      setBusy(true);
      const res = await api.rankUpChampion(selectedChamp.id, fodder);
      flash(`${res.champion.name} promoted to rank ${res.champion.rank}! Level cap raised to ${res.champion.max_level}.`);
      setRankUpOpen(false);
      setFodder([]);
      if (onRefreshChampions) onRefreshChampions();
      if (onRefreshArtifacts) onRefreshArtifacts();
      if (onRefreshPlayer) onRefreshPlayer(res.player);
    } catch (err) {
      flash(err.message, 'warn');
    } finally {
      setBusy(false);
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
  const base = selectedChamp?.base_stats;
  const atMax = selectedChamp && selectedChamp.level >= selectedChamp.max_level;
  const setCounts = Object.values(equippedArtifactsBySlot).reduce((acc, a) => {
    acc[a.set_type] = (acc[a.set_type] || 0) + 1;
    return acc;
  }, {});

  const STAT_ROWS = [
    { key: 'max_hp', label: 'HULL HP', color: 'text-emerald-400' },
    { key: 'max_shields', label: 'SHIELDS', color: 'text-cyan-400' },
    { key: 'attack', label: 'ATTACK', color: 'text-amber-400' },
    { key: 'defense', label: 'DEFENSE', color: 'text-blue-400' },
    { key: 'speed', label: 'SPEED', color: 'text-cyan-300' },
    { key: 'crit_rate', label: 'CRIT RATE', color: 'text-purple-400', fmt: (v) => `${Math.round((v || 0) * 100)}%` },
    { key: 'crit_damage', label: 'CRIT DMG', color: 'text-purple-300', fmt: (v) => `${Math.round((v || 0) * 100)}%` },
    { key: 'accuracy', label: 'ACCURACY', color: 'text-sky-300' },
    { key: 'resistance', label: 'RESIST', color: 'text-violet-300' },
  ];

  const TABS = [
    { id: 'gear', label: 'Equipment', icon: Swords },
    { id: 'vault', label: `Vault (${artifacts?.length || 0})`, icon: Package },
    { id: 'gambits', label: 'AI Gambits', icon: Brain },
  ];

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-150px)] lg:min-h-[640px]">
      {/* Toast */}
      {feedbackMsg && (
        <div className={`fixed top-20 right-6 z-50 max-w-md p-2.5 rounded-lg font-mono text-xs flex items-center gap-2 border shadow-2xl ${
          feedbackTone === 'warn' ? 'bg-amber-950/95 border-amber-500/50 text-amber-200' : 'bg-cyan-950/95 border-cyan-400/50 text-cyan-300'
        }`}>
          {feedbackTone === 'warn' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Check className="w-4 h-4 text-cyan-400" />}
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ── Left: roster ── */}
        <div className="lg:col-span-3 hud-panel rounded-2xl p-3 border border-cyan-500/20 flex flex-col min-h-0 max-h-[70vh] lg:max-h-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <h3 className="font-orbitron font-bold text-sm text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              OPERATIVES ({filteredChampions?.length || 0})
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-1 my-2 text-[12px] font-mono">
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

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {filteredChampions?.map((c) => {
              const isSelected = selectedChamp?.id === c.id;
              const r = rarityStyle(c.rarity);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChampionId(c.id)}
                  className={`w-full p-1.5 rounded-xl border flex items-center gap-2.5 text-left transition ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/60 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-[#080d1a] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <HeroPortrait name={c.name} className={`w-12 h-14 rounded-lg border-2 shrink-0 ${r.border}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                      {inSquad.has(c.id) && (
                        <span className="text-[10px] font-mono px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 shrink-0">SQUAD</span>
                      )}
                    </div>
                    <Stars value={c.rank} size="w-2.5 h-2.5" />
                    <span className="text-[12px] font-mono text-slate-400 block truncate">
                      <span className={r.text}>{c.rarity}</span> · LVL {c.level}/{c.max_level}
                      {c.can_rank_up && <span className="ml-1 text-amber-300">▲</span>}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedChamp && (
          <div className="lg:col-span-9 flex flex-col gap-3 min-h-0">
            {/* Tabs */}
            <div className="shrink-0 flex items-center gap-1.5">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3.5 py-1.5 rounded-lg font-mono text-xs uppercase font-bold transition flex items-center gap-1.5 ${
                    activeTab === id
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {activeTab === 'gear' && (
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-9 gap-3">
                {/* ── Center: hero showcase ── */}
                <div className="md:col-span-5 relative rounded-2xl border-2 border-cyan-500/30 overflow-hidden bg-black min-h-[520px] flex flex-col">
                  <div
                    className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(34,211,238,0.14), rgba(0,0,0,0) 65%)' }}
                  />
                  <div className="absolute inset-x-0 top-14 bottom-40">
                    <HeroArt name={selectedChamp.name} className="w-full h-full" />
                  </div>
                  {/* corner brackets */}
                  <span className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-400/70" />
                  <span className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-400/70" />

                  {/* Identity */}
                  <div className="relative px-4 pt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-orbitron font-black text-xl text-slate-100 truncate drop-shadow">{selectedChamp.name}</h2>
                      <p className="text-[13px] font-mono text-slate-400 truncate">{selectedChamp.title} — {selectedChamp.faction}</p>
                      <Stars value={selectedChamp.rank} size="w-4 h-4" className="mt-1" />
                      {selectedChamp.passive && (
                        <div className="mt-2 max-w-[260px]">
                          <PassiveBlock passive={selectedChamp.passive} compact />
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono text-[12px] uppercase px-2 py-0.5 rounded border ${rarityStyle(selectedChamp.rarity).border} ${rarityStyle(selectedChamp.rarity).text} bg-black/60`}>
                        {selectedChamp.rarity} · {selectedChamp.role}
                      </div>
                      <div className="font-orbitron font-black text-2xl text-slate-100 mt-1 drop-shadow">
                        {selectedChamp.level}<span className="text-sm text-slate-500">/{selectedChamp.max_level}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 -mt-1">LEVEL</div>
                    </div>
                  </div>

                  {/* Progression + stats */}
                  <div className="relative mt-auto bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-8 pb-3 space-y-2.5">
                    <div className="grid grid-cols-5 2xl:grid-cols-9 gap-1.5 text-center font-mono">
                      {STAT_ROWS.map(({ key, label, color, fmt }) => {
                        const v = eff?.[key];
                        const bonus = base && typeof base[key] === 'number' ? v - base[key] : 0;
                        return (
                          <div key={key} className="rounded-lg bg-slate-950/80 border border-slate-800 py-1.5 px-1" title={bonus ? `Base ${fmt ? fmt(base[key]) : base[key]}` : undefined}>
                            <div className="text-[13px] text-slate-400 truncate">{label}</div>
                            <div className={`text-lg leading-tight font-bold ${color}`}>{fmt ? fmt(v) : v}</div>
                            {bonus > 0.0001 && (
                              <div className="text-[13px] text-emerald-400 leading-none">+{fmt ? fmt(bonus) : Math.round(bonus)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between font-mono text-xs text-slate-400 mb-0.5">
                          <span>
                            {atMax
                              ? `MAX LEVEL FOR RANK ${selectedChamp.rank}`
                              : `XP ${selectedChamp.experience}/${selectedChamp.xp_to_next}`}
                          </span>
                          <span className="flex items-center gap-1 text-purple-300">
                            <FlaskConical className="w-3 h-3" /> {(player?.champion_xp || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                          <div
                            className={`h-full ${atMax ? 'bg-amber-400' : 'bg-purple-500'}`}
                            style={{ width: `${atMax ? 100 : Math.min(100, (selectedChamp.experience / Math.max(1, selectedChamp.xp_to_next)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {!atMax ? (
                        <>
                          <button
                            disabled={busy || !player?.champion_xp}
                            onClick={() => handleFeed(selectedChamp.xp_to_next - selectedChamp.experience)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/50 text-purple-200 font-mono text-[12px] disabled:opacity-40"
                          >
                            +1 LVL
                          </button>
                          <button
                            disabled={busy || !player?.champion_xp}
                            onClick={() => handleFeed(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-[12px] font-bold disabled:opacity-40"
                          >
                            FEED MAX
                          </button>
                        </>
                      ) : selectedChamp.rank < selectedChamp.max_rank ? (
                        <button
                          disabled={busy}
                          onClick={() => { setFodder([]); setRankUpOpen(true); }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-orbitron font-bold text-[12px] flex items-center gap-1"
                        >
                          <ChevronsUp className="w-4 h-4" /> RANK UP
                        </button>
                      ) : (
                        <span className="font-mono text-[12px] text-amber-300">MAX RANK</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Right: equipment / abilities ── */}
                <div className="md:col-span-4 hud-panel rounded-2xl p-3 border border-cyan-500/20 flex flex-col gap-2 min-h-0 overflow-y-auto">
                  <div className="shrink-0 grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/50 border border-slate-800">
                    {[
                      { id: 'equipment', label: 'Equipment', icon: Swords, badge: `${Object.keys(equippedArtifactsBySlot).length}/${SLOTS.length}` },
                      { id: 'abilities', label: 'Abilities', icon: Sparkles, badge: selectedChamp.cards?.length || 0 },
                    ].map(({ id, label, icon: Icon, badge }) => (
                      <button
                        key={id}
                        onClick={() => setRightTab(id)}
                        className={`py-1.5 rounded-lg font-orbitron font-bold text-[13px] tracking-wider flex items-center justify-center gap-1.5 transition ${
                          rightTab === id ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/50 shadow shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label.toUpperCase()}
                        <span className="font-mono text-[12px] text-slate-500">{badge}</span>
                      </button>
                    ))}
                  </div>

                  {rightTab === 'equipment' ? (
                    <>
                    <div className="grid grid-cols-1 gap-2">
                      {SLOTS.map((slot) => (
                        <GearSlot
                          key={slot}
                          slot={slot}
                          artifact={equippedArtifactsBySlot[slot]}
                          onClick={() => setSelectedSlotForEquip(slot)}
                        />
                      ))}
                    </div>

                    <div className="mt-1 rounded-xl border border-slate-800 bg-black/40 p-2.5">
                      <div className="font-mono text-[12px] tracking-widest text-slate-500 mb-1.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> SETS
                      </div>
                      {Object.keys(setCounts).length === 0 ? (
                        <div className="font-mono text-[12px] text-slate-600">No artifacts equipped.</div>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(setCounts).sort((a, b) => b[1] - a[1]).map(([set, n]) => (
                            <div key={set} className="flex items-center justify-between font-mono text-[13px]">
                              <span className={n >= 2 ? 'text-amber-300' : 'text-slate-400'}>{set}</span>
                              <span className="flex gap-0.5">
                                {Array.from({ length: Math.max(2, n) }).map((_, i) => (
                                  <span key={i} className={`w-2 h-2 rounded-sm ${i < n ? 'bg-amber-400' : 'bg-slate-700'}`} />
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                      <p className="font-mono text-[11px] text-slate-600 mt-auto">Click a slot to open your inventory, compare and equip.</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {selectedChamp.passive && <PassiveBlock passive={selectedChamp.passive} />}
                      {selectedChamp.cards?.map((card, i) => {
                        const img = SKILL_IMAGES[card.name];
                        return (
                          <div key={card.id} className={`rounded-xl border p-2.5 ${card.summon_troop_id ? 'border-emerald-600/50 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/70'}`}>
                            <div className="flex items-start gap-2.5">
                              <div className="w-12 h-12 shrink-0 rounded-lg bg-black/60 border border-slate-700 overflow-hidden flex items-center justify-center">
                                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Sparkles className="w-6 h-6 text-cyan-300" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[12px] text-slate-500">{i + 1}</span>
                                  <span className="font-orbitron font-bold text-sm text-slate-100">{card.name}</span>
                                  <span className="font-mono text-[12px] px-1 rounded border border-cyan-500/50 text-cyan-300 bg-cyan-950/40">
                                    {SCOPE_LABEL[card.lane_scope] || 'LANE'}
                                  </span>
                                  {card.cooldown_turns > 0 && (
                                    <span className="font-mono text-[12px] px-1 rounded border border-slate-600 text-slate-400">CD {card.cooldown_turns}</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 leading-snug mt-1">{card.description}</p>
                                <div className="mt-1 space-y-0.5 font-mono text-[13px]">
                                  {card.power_multiplier > 0 && (
                                    <div className="text-amber-300/90">• {Math.round(card.power_multiplier * 100)}% ATK to {TARGET_LABEL[card.target_type] || card.target_type}</div>
                                  )}
                                  {card.heal_multiplier > 0 && <div className="text-emerald-300/90">• Heals {Math.round(card.heal_multiplier * 100)}% ATK</div>}
                                  {card.shield_grant > 0 && <div className="text-cyan-300/90">• +{card.shield_grant} shields</div>}
                                  {card.summon_troop_id && <div className="text-emerald-300/90">• Summons a troop pack</div>}
                                  {card.effects?.map((e, k) => (
                                    <div key={k} className={e.is_buff ? 'text-cyan-300/90' : 'text-red-300/90'}>• {e.description}</div>
                                  ))}
                                </div>
                                {card.effects?.length > 0 && <div className="mt-1.5"><EffectSpecChips effects={card.effects} size="md" /></div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vault: all owned artifacts, upgrade from here */}
            {activeTab === 'vault' && (
              <div className="flex-1 min-h-0 hud-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-orbitron font-bold text-sm text-slate-100">ARTIFACT VAULT</h4>
                  <div className="flex flex-wrap gap-1 font-mono text-[12px]">
                    {['ALL', ...SLOTS].map((sl) => (
                      <button
                        key={sl}
                        onClick={() => setVaultSlot(sl)}
                        className={`px-2 py-1 rounded ${vaultSlot === sl ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                      >
                        {sl}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="font-mono text-[12px] text-slate-500">
                  Upgrades cost credits even when they fail; success chance drops as the level rises. Every +4 adds a substat (up to 4), then boosts one.
                </p>
                <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto pr-1 content-start">
                  {artifacts
                    ?.filter((a) => vaultSlot === 'ALL' || a.slot === vaultSlot)
                    .sort(SORTS.rank)
                    .map((art) => (
                      <ArtifactCard
                        key={art.id}
                        artifact={art}
                        busy={busy}
                        equippedName={art.equipped_to ? championName(art.equipped_to) : null}
                        onUpgrade={(a) => handleUpgrade(a.id)}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* AI Gambits */}
            {activeTab === 'gambits' && (
              <div className="flex-1 min-h-0 overflow-y-auto hud-panel rounded-2xl p-5 border border-cyan-500/20 space-y-4">
                <div>
                  <h4 className="font-orbitron font-bold text-sm text-slate-100">AUTOMATED AI GAMBIT BEHAVIORS</h4>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Evaluated in order of priority when timer expires or during background expeditions.
                  </p>
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
                      <select
                        value={gambit.condition}
                        onChange={(e) => handleGambitChange(idx, 'condition', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 flex-1 min-w-[200px]"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                      <select
                        value={gambit.card_id}
                        onChange={(e) => handleGambitChange(idx, 'card_id', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 min-w-[180px]"
                      >
                        {selectedChamp.cards?.map((card) => (
                          <option key={card.id} value={card.id}>Action: {card.name}</option>
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

      {selectedSlotForEquip && selectedChamp && (
        <GearPickerModal
          slot={selectedSlotForEquip}
          champion={selectedChamp}
          artifacts={artifacts}
          equipped={equippedArtifactsBySlot[selectedSlotForEquip]}
          championName={championName}
          busy={busy}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUpgrade={handleUpgrade}
          onClose={() => setSelectedSlotForEquip(null)}
        />
      )}

      {rankUpOpen && selectedChamp && (() => {
        const needed = selectedChamp.rank_up_fodder;
        const eligible = (champions || []).filter(
          (c) => c.id !== selectedChamp.id && c.rank >= selectedChamp.rank && !inSquad.has(c.id),
        );
        const toggle = (id) => setFodder((f) => (f.includes(id) ? f.filter((x) => x !== id) : f.length < needed ? [...f, id] : f));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setRankUpOpen(false)}>
            <div className="w-full max-w-lg hud-panel rounded-2xl border border-amber-500/50 p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-orbitron font-black text-lg text-slate-100">RANK UP {selectedChamp.name.toUpperCase()}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Stars value={selectedChamp.rank} /> <ChevronRight className="w-4 h-4 text-slate-500" /> <Stars value={selectedChamp.rank + 1} />
                  </div>
                  <p className="font-mono text-[13px] text-slate-400 mt-2">
                    Consumes {needed} champion{needed > 1 ? 's' : ''} of rank {selectedChamp.rank}+ (not in a squad) and{' '}
                    {selectedChamp.rank_up_cost?.toLocaleString()} credits. Level resets to 1, cap rises to {(selectedChamp.rank + 1) * 10}.
                    Fodder gear returns to the vault.
                  </p>
                </div>
                <button onClick={() => setRankUpOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {eligible.length === 0 && (
                  <div className="font-mono text-xs text-slate-500 py-6 text-center">
                    No eligible fodder. Summon more champions or rank up others first.
                  </div>
                )}
                {eligible.map((c) => {
                  const picked = fodder.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        picked ? 'border-red-400 bg-red-950/40' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <HeroPortrait name={c.name} className={`w-9 h-10 rounded-md border shrink-0 ${rarityStyle(c.rarity).border}`} />
                        <div>
                          <div className="font-bold text-xs text-slate-100">{c.name}</div>
                          <div className="font-mono text-[12px] text-slate-400">{c.rarity} · LVL {c.level}</div>
                        </div>
                      </div>
                      <Stars value={c.rank} size="w-2.5 h-2.5" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{fodder.length}/{needed} selected</span>
                <button
                  disabled={busy || fodder.length !== needed || (player?.credits || 0) < selectedChamp.rank_up_cost}
                  onClick={handleRankUp}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-orbitron font-bold text-xs uppercase disabled:opacity-40"
                >
                  Confirm Rank Up
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
