import React, { useEffect, useMemo, useState } from 'react';
import { X, Rocket, Users, Swords, Heart, Shield, Check, Crown } from 'lucide-react';
import { api } from '../../services/api';
import { factionTone, getPortrait } from '../../utils/battleVisuals';
import DifficultySelector from './DifficultySelector';

const MAX_BOSS_HEROES = 3;

/**
 * Pre-battle loadout: attribute troop packs to each hero.
 * Expedition: the squad's heroes. Boss encounter (`boss` set): pick up to 3 heroes first.
 * Troops follow their hero into whichever lane the hero is deployed to.
 */
export default function RunSetupModal({ biome, boss = null, squad, champions, onClose, onLaunched }) {
  const [catalog, setCatalog] = useState(null);
  const [loadout, setLoadout] = useState({});
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState(1);
  const [picked, setPicked] = useState(() => (squad?.champion_ids || []).slice(0, MAX_BOSS_HEROES));

  const heroIds = boss ? picked : (squad?.champion_ids || []);
  const heroes = useMemo(
    () => heroIds.map((id) => champions.find((c) => c.id === id)).filter(Boolean),
    [heroIds.join(','), champions], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    api.getTroopCatalog().then(setCatalog).catch((e) => setError(e.message));
  }, []);

  // Default packs for newly added heroes; keep the player's picks for the others.
  useEffect(() => {
    if (!catalog) return;
    setLoadout((prev) => {
      const next = {};
      heroes.forEach((h) => {
        next[h.id] = prev[h.id] || catalog.templates
          .filter((t) => t.faction === h.faction)
          .slice(0, catalog.troops_per_hero)
          .map((t) => t.id);
      });
      return next;
    });
  }, [catalog, heroes]);

  const toggleHero = (id) => {
    setPicked((prev) => (prev.includes(id)
      ? prev.filter((x) => x !== id)
      : prev.length >= MAX_BOSS_HEROES ? prev : [...prev, id]));
  };

  const toggleTroop = (heroId, templateId) => {
    setLoadout((prev) => {
      const current = prev[heroId] || [];
      const count = current.filter((t) => t === templateId).length;
      const max = catalog?.troops_per_hero ?? 2;
      // Click cycles: add a pack while room remains, otherwise remove all of that type.
      if (current.length < max) return { ...prev, [heroId]: [...current, templateId] };
      if (count > 0) return { ...prev, [heroId]: current.filter((t) => t !== templateId) };
      return prev;
    });
  };

  const removeOne = (heroId, templateId) => {
    setLoadout((prev) => {
      const current = [...(prev[heroId] || [])];
      const idx = current.lastIndexOf(templateId);
      if (idx >= 0) current.splice(idx, 1);
      return { ...prev, [heroId]: current };
    });
  };

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const run = boss
        ? await api.startBossRun(boss.id, picked, loadout, difficulty)
        : await api.startRun(biome.id, squad.id, loadout, difficulty);
      onLaunched(run);
    } catch (e) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto hud-panel rounded-2xl border border-cyan-500/40 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`font-mono text-[12px] tracking-widest ${boss ? 'text-orange-400' : 'text-cyan-400'}`}>
              {boss ? 'BOSS ENCOUNTER LOADOUT' : 'EXPEDITION LOADOUT'}
            </span>
            <h3 className="font-orbitron font-black text-xl text-slate-100">{boss ? `${boss.name} — ${boss.title}` : biome.name}</h3>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Assign up to {catalog?.troops_per_hero ?? 2} troop packs per hero. Troops fight in their hero&apos;s lane.
              Losses carry over between nodes.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <DifficultySelector biome={boss || biome} value={difficulty} onChange={setDifficulty} />

        {boss && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[12px] tracking-widest text-slate-400">STRIKE SQUAD</span>
              <span className={`font-mono text-[12px] ${picked.length === MAX_BOSS_HEROES ? 'text-emerald-300' : 'text-amber-300'}`}>
                {picked.length}/{MAX_BOSS_HEROES} HEROES · one per lane
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {champions.map((c) => {
                const on = picked.includes(c.id);
                const full = !on && picked.length >= MAX_BOSS_HEROES;
                const tone = factionTone(c.faction);
                const portrait = getPortrait(c.name);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleHero(c.id)}
                    disabled={full}
                    title={`${c.name} — Lv ${c.level}`}
                    className={`relative rounded-lg border-2 overflow-hidden bg-black transition ${
                      on ? 'border-orange-400 ring-2 ring-orange-400/60' : `${tone.border} hover:brightness-125`
                    } ${full ? 'opacity-35 cursor-not-allowed' : ''}`}
                  >
                    <div className="aspect-square bg-slate-900 flex items-center justify-center">
                      {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover object-top" /> : <Swords className={`w-1/3 h-1/3 ${tone.text}`} />}
                    </div>
                    <div className="px-1 py-0.5 font-orbitron text-[11px] font-bold text-slate-100 truncate">{c.name}</div>
                    <div className="px-1 pb-0.5 font-mono text-[10px] text-slate-400">Lv {c.level}</div>
                    {on && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-black" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!catalog && !error && <div className="py-10 text-center font-mono text-xs text-slate-500">Loading troop manifest…</div>}

        <div className="space-y-3">
          {catalog && heroes.map((hero) => {
            const tone = factionTone(hero.faction);
            const portrait = getPortrait(hero.name);
            const picked = loadout[hero.id] || [];
            const options = catalog.templates.filter((t) => t.faction === hero.faction);
            return (
              <div key={hero.id} className={`rounded-xl border ${tone.border} bg-black/40 p-3 flex flex-col sm:flex-row gap-3`}>
                <div className="flex items-center gap-3 sm:w-52 shrink-0">
                  <div className={`w-14 h-14 rounded-lg overflow-hidden border ${tone.border} bg-slate-900 flex items-center justify-center`}>
                    {portrait ? <img src={portrait} alt="" className="w-full h-full object-cover object-top" /> : <Swords className={`w-6 h-6 ${tone.text}`} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-orbitron font-bold text-sm text-slate-100 truncate">{hero.name}</div>
                    <div className={`text-[12px] font-mono ${tone.text}`}>{hero.faction}</div>
                    <div className="text-[12px] font-mono text-slate-500">PACKS {picked.length}/{catalog.troops_per_hero}</div>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((t) => {
                    const n = picked.filter((p) => p === t.id).length;
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleTroop(hero.id, t.id)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleTroop(hero.id, t.id)}
                        className={`text-left rounded-lg border px-3 py-2 transition cursor-pointer ${
                          n > 0 ? `${tone.border} ${tone.bg}` : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-orbitron font-bold text-xs text-slate-100 flex items-center gap-1.5">
                            <Users className={`w-3.5 h-3.5 ${tone.text}`} /> {t.name}
                          </span>
                          {n > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeOne(hero.id, t.id); }}
                              className={`text-[12px] font-mono px-1.5 rounded ${tone.bg} ${tone.text} border ${tone.border}`}
                              title="Remove one pack"
                            >
                              ×{n}
                            </button>
                          )}
                        </div>
                        <div className="text-[12px] font-mono text-slate-400 mt-1 flex gap-3">
                          <span>{t.count} soldiers</span>
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{t.unit_hp * t.count}</span>
                          <span className="flex items-center gap-0.5"><Swords className="w-3 h-3" />{t.unit_attack * t.count}</span>
                          <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" />{t.defense}</span>
                        </div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{t.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-3 text-xs font-mono text-red-400">{error}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron text-xs uppercase">
            Cancel
          </button>
          <button
            disabled={launching || !catalog || heroes.length === 0}
            onClick={launch}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-orbitron font-bold text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
          >
            {boss ? <><Crown className="w-4 h-4" /> Engage Boss</> : <><Rocket className="w-4 h-4" /> Launch Descent</>}
          </button>
        </div>
      </div>
    </div>
  );
}
