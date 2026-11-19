import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Rocket, Users, Swords, Heart, Shield, Check, Crown, Crosshair, Gem, Plus, Minus, Factory, AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import { factionTone, getPortrait, getTroopArt } from '../../utils/battleVisuals';
import DifficultySelector from './DifficultySelector';

function Step({ n, title, right, children }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="flex items-center gap-2 font-orbitron font-bold text-[14px] tracking-widest text-slate-100">
          <span className="w-6 h-6 rounded-full bg-cyan-500 text-black text-[12px] font-black flex items-center justify-center">{n}</span>
          {title}
        </h4>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Launch screen for an expedition (`biome`) or a boss encounter (`boss`): pick the heroes,
 * the troop packs taken from the barracks garrison, and the threat level — then launch.
 */
export default function RunSetupModal({ biome, boss = null, target = null, squad, champions, onClose, onLaunched, onOpenBarracks }) {
  const [catalog, setCatalog] = useState(null);
  const [barracks, setBarracks] = useState(null);
  const [reserve, setReserve] = useState([]);   // troop template ids (repeats allowed)
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState(1);
  const maxHeroes = boss ? (catalog?.max_heroes ?? 3) : (catalog?.max_expedition_heroes ?? 4);
  const [picked, setPicked] = useState(() => (squad?.champion_ids || []).slice(0, boss ? 3 : 4));

  useEffect(() => {
    Promise.all([api.getTroopCatalog(), api.getBarracks()])
      .then(([c, b]) => { setCatalog(c); setBarracks(b); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const maxPacks = catalog?.reserve_size ?? 6;
  const garrison = useMemo(() => (barracks?.troops || []).filter((t) => t.owned > 0), [barracks]);
  const heroes = picked.map((id) => champions.find((c) => c.id === id)).filter(Boolean);
  // Roster order: picked first, then strongest (frozen at open so cards don't jump while picking).
  const [order] = useState(() => [...champions].sort((a, b) =>
    ((squad?.champion_ids || []).includes(b.id) - (squad?.champion_ids || []).includes(a.id)) || (b.level - a.level)));
  const countOf = (id) => reserve.filter((x) => x === id).length;

  const toggleHero = (id) => {
    setPicked((prev) => (prev.includes(id)
      ? prev.filter((x) => x !== id)
      : prev.length >= maxHeroes ? prev : [...prev, id]));
  };
  const addPack = (t) => {
    setReserve((prev) => (prev.length >= maxPacks || prev.filter((x) => x === t.id).length >= t.owned ? prev : [...prev, t.id]));
  };
  const removePack = (id) => {
    setReserve((prev) => {
      const idx = prev.lastIndexOf(id);
      return idx < 0 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const run = boss
        ? await api.startBossRun(boss.id, picked, reserve, difficulty)
        : await api.startRun(biome.id, squad?.id || 'squad_alpha', reserve, difficulty, picked);
      onLaunched(run);
    } catch (e) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  };

  const accent = boss ? 'text-orange-400' : 'text-cyan-400';
  const templateOf = (id) => barracks?.troops.find((t) => t.id === id);

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-enter w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-cyan-500/40 shadow-[0_0_60px_rgba(34,211,238,0.15)] overflow-hidden"
        style={{ background: 'rgba(6, 11, 24, 0.98)' }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-white/5">
          <div>
            <span className={`font-mono text-[12px] tracking-[0.3em] ${accent}`}>{boss ? 'BOSS ENCOUNTER LOADOUT' : 'EXPEDITION LOADOUT'}</span>
            <h3 className="font-orbitron font-black text-2xl text-slate-100">{boss ? `${boss.name} — ${boss.title}` : biome.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400" title="Close [Esc]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          {/* Left: heroes + troops */}
          <div className="min-h-0 overflow-y-auto px-6 py-4 space-y-6">
            <Step
              n={1}
              title="STRIKE SQUAD"
              right={<span className={`font-mono text-[12px] ${picked.length ? 'text-emerald-300' : 'text-amber-300'}`}>{picked.length}/{maxHeroes} HEROES{boss ? ' · one per lane' : ' · 3 lanes + bench'}</span>}
            >
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {order.map((c) => {
                  const on = picked.includes(c.id);
                  const full = !on && picked.length >= maxHeroes;
                  const tone = factionTone(c.faction);
                  const portrait = getPortrait(c.name);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleHero(c.id)}
                      disabled={full}
                      title={`${c.name} — Lv ${c.level}`}
                      className={`relative rounded-lg border-2 overflow-hidden bg-black transition ${
                        on ? 'border-cyan-300 ring-2 ring-cyan-400/60' : `${tone.border} opacity-70 hover:opacity-100`
                      } ${full ? '!opacity-25 cursor-not-allowed' : ''}`}
                    >
                      <div className="aspect-square bg-slate-900 flex items-center justify-center">
                        {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover object-top" /> : <Swords className={`w-1/3 h-1/3 ${tone.text}`} />}
                      </div>
                      <div className="px-1 py-0.5 font-orbitron text-[11px] font-bold text-slate-100 truncate">{c.name}</div>
                      <div className="px-1 pb-0.5 font-mono text-[10px] text-slate-400">Lv {c.level}</div>
                      {on && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-black" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step
              n={2}
              title="TROOP RESERVE"
              right={<span className={`font-mono text-[12px] ${reserve.length ? 'text-violet-300' : 'text-slate-500'}`}>{reserve.length}/{maxPacks} PACKS</span>}
            >
              <p className="font-mono text-[12px] text-slate-400 mb-2">
                Packs leave the barracks garrison. In battle, spend mana to deploy them — every battle opens with at least {catalog?.mana_floor ?? 3} mana.
                Survivors return when you come back; on defeat they are lost.
              </p>
              {/* Slots */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                {Array.from({ length: maxPacks }, (_, i) => {
                  const t = templateOf(reserve[i]);
                  if (!t) {
                    return <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-slate-700 bg-black/30 flex items-center justify-center font-mono text-[11px] text-slate-600">EMPTY</div>;
                  }
                  return (
                    <button key={i} onClick={() => removePack(t.id)} title={`${t.name} — click to remove`}
                      className={`group relative aspect-square rounded-xl border-2 overflow-hidden bg-black ${factionTone(t.faction).border}`}>
                      <img src={getTroopArt({ template_id: t.id, name: t.name })} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/80 font-orbitron text-[10px] font-bold text-slate-100 truncate">{t.name}</span>
                      <span className="absolute top-1 right-1 flex items-center gap-0.5 px-1 rounded bg-violet-950/90 border border-violet-400/70 font-orbitron font-black text-[11px] text-violet-100">
                        <Gem className="w-3 h-3" />{t.mana_cost}
                      </span>
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-red-950/70"><X className="w-6 h-6 text-red-200" /></span>
                    </button>
                  );
                })}
              </div>
              {/* Garrison */}
              {!barracks && !error && <div className="py-6 text-center font-mono text-xs text-slate-500">Reading the garrison manifest…</div>}
              {barracks && garrison.length === 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-[13px] text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> The garrison is empty — train troops in the Barracks, or launch with heroes only.
                  </span>
                  {onOpenBarracks && (
                    <button onClick={onOpenBarracks} className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-orbitron font-bold text-[12px] flex items-center gap-1.5">
                      <Factory className="w-4 h-4" /> Barracks
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {garrison.map((t) => {
                  const tone = factionTone(t.faction);
                  const n = countOf(t.id);
                  const left = t.owned - n;
                  return (
                    <div key={t.id} className={`flex gap-3 rounded-xl border p-2 transition ${n > 0 ? `${tone.border} ${tone.bg}` : 'border-slate-700 bg-slate-900/60'}`}>
                      <div className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border ${tone.border} bg-black`}>
                        <img src={getTroopArt({ template_id: t.id, name: t.name })} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-orbitron font-bold text-[13px] text-slate-100 truncate">{t.name}</span>
                          <span className="shrink-0 flex items-center gap-1 px-1.5 rounded-md border-2 border-violet-300/70 bg-violet-950/90 font-orbitron font-black text-[13px] text-violet-100" title="Mana to deploy">
                            <Gem className="w-3.5 h-3.5" />{t.mana_cost}
                          </span>
                        </div>
                        <div className={`text-[12px] font-mono ${tone.text}`}>{left} in garrison</div>
                        <div className="text-[12px] font-mono text-slate-400 mt-0.5 flex gap-3">
                          <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{t.stats.count}</span>
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{t.stats.hp}</span>
                          <span className="flex items-center gap-0.5"><Swords className="w-3 h-3" />{t.stats.volley}</span>
                          <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" />{t.stats.defense}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-center justify-center gap-1">
                        <button onClick={() => addPack(t)} disabled={reserve.length >= maxPacks || left <= 0} title="Add a pack"
                          className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-violet-600">
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="font-orbitron font-black text-sm text-slate-100 tabular-nums">{n}</span>
                        <button onClick={() => removePack(t.id)} disabled={n === 0} title="Remove a pack"
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-30">
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Step>
          </div>

          {/* Right: threat + summary + launch */}
          <aside className="min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-white/5 bg-black/30">
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {!boss && target && (
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 flex items-start gap-2 font-mono text-[13px] text-cyan-100">
                <Crosshair className="w-4 h-4 mt-0.5 text-cyan-300 shrink-0" />
                <span>
                  Hunting <b>{target.name}</b> — battles won add Influence ({target.standing.influence}/{target.influence_required}).
                  Their {target.guard?.name || 'guards'} will be waiting.
                </span>
              </div>
            )}
            {boss?.adaptations?.length > 0 && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 font-mono text-[13px] text-red-200">
                {boss.name} has adapted: {boss.adaptations.map((a) => a.name).join(', ')}.
              </div>
            )}

            <Step n={3} title="THREAT LEVEL">
              <DifficultySelector biome={boss || biome} value={difficulty} onChange={setDifficulty} compact />
            </Step>

            </div>
            {/* Always visible: summary + launch */}
            <div className="shrink-0 px-5 py-4 border-t border-white/10 space-y-3 bg-black/40">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
              <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500">SUMMARY</div>
              <div className="flex -space-x-2">
                {heroes.map((h) => (
                  <img key={h.id} src={getPortrait(h.name)} alt={h.name} title={h.name}
                    className={`w-10 h-10 rounded-full object-cover object-top border-2 ${factionTone(h.faction).border} bg-black`} />
                ))}
                {!heroes.length && <span className="font-mono text-[13px] text-amber-300">Pick at least one hero.</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-400 text-center">
                <div><b className="block font-orbitron text-lg text-slate-100">{heroes.length}</b>HEROES</div>
                <div><b className="block font-orbitron text-lg text-violet-200">{reserve.length}</b>PACKS</div>
                <div><b className="block font-orbitron text-lg text-red-300">{difficulty}</b>THREAT</div>
              </div>
            </div>

            {error && <div className="text-xs font-mono text-red-400">{error}</div>}

            <button
              disabled={launching || !catalog || heroes.length === 0}
              onClick={launch}
              className={`w-full px-6 py-4 rounded-xl text-white font-orbitron font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 ${
                boss ? 'bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600' : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600'
              }`}
            >
              {boss ? <><Crown className="w-5 h-5" /> Engage Boss</> : <><Rocket className="w-5 h-5" /> Launch Descent</>}
            </button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
