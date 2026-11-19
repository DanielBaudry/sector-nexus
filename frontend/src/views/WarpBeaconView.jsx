import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, FileCode2, Atom, Lock, Loader2, Satellite, Crown, Users } from 'lucide-react';
import { api } from '../services/api';
import { factionTone, getPortrait } from '../utils/battleVisuals';

const RARITY_COLOR = { Common: '#94a3b8', Rare: '#38bdf8', Epic: '#c084fc', Legendary: '#fbbf24' };

function ProgressBar({ value, max, ready }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden border border-white/5">
      <div
        className={`h-full transition-[width] duration-700 ${ready ? 'bg-gradient-to-r from-emerald-400 to-teal-300' : 'bg-gradient-to-r from-sky-600 to-teal-400'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BlueprintRow({ hero, cost, selected, onSelect }) {
  const tone = factionTone(hero.faction);
  const known = hero.blueprint;
  const portrait = getPortrait(hero.name);
  return (
    <button
      onClick={() => onSelect(hero.template_id)}
      className={`w-full flex items-center gap-3 rounded-xl border-2 p-2 text-left transition ${
        selected ? 'border-sky-300 bg-sky-950/50 shadow-[0_0_18px_rgba(56,189,248,0.25)]' : `${known ? tone.border : 'border-slate-800'} bg-black/40 hover:bg-slate-900/70`
      }`}
    >
      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-white/10">
        {portrait && <img src={portrait} alt="" className={`w-full h-full object-cover object-top ${known ? '' : 'blur-[3px] grayscale brightness-[0.35]'}`} />}
        {!known && <Lock className="absolute inset-0 m-auto w-5 h-5 text-slate-400" />}
        {hero.ready && <span className="absolute inset-0 ring-2 ring-inset ring-emerald-400 rounded-lg animate-pulse" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-orbitron font-bold text-[13px] truncate ${known ? 'text-slate-100' : 'text-slate-500'}`}>
            {known ? hero.name : 'Unknown blueprint'}
          </span>
          {hero.ready
            ? <span className="shrink-0 font-mono text-[10px] px-1.5 rounded bg-emerald-500 text-black font-bold">READY</span>
            : hero.owned > 0 && known && <span className="shrink-0 font-mono text-[11px] text-slate-400">×{hero.owned}</span>}
        </div>
        <div className={`font-mono text-[11px] ${known ? tone.text : 'text-slate-600'}`}>{known ? hero.faction : 'Signal fragment'}</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1"><ProgressBar value={hero.materials} max={cost} ready={hero.ready} /></div>
          <span className="font-mono text-[11px] text-teal-300 tabular-nums">{hero.materials}/{cost}</span>
        </div>
      </div>
    </button>
  );
}

/**
 * The print chamber: the hero materialises bottom-up as print materials accumulate.
 * Below 100% it is a dim hologram; the printed part is in full colour with a glowing print head.
 */
function PrintChamber({ hero, cost, printing }) {
  const portrait = getPortrait(hero.name);
  const progress = hero.blueprint ? Math.min(1, hero.materials / cost) : 0;
  const top = `${(1 - progress) * 100}%`;
  const color = RARITY_COLOR[hero.rarity] || '#38bdf8';
  return (
    <div className="relative aspect-[3/4] w-full max-w-[420px] mx-auto rounded-2xl overflow-hidden border-2 bg-[#020611]"
      style={{ borderColor: `${color}88`, boxShadow: `0 0 40px ${color}33, inset 0 0 60px rgba(0,0,0,0.9)` }}>
      {/* Chamber grid */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(56,189,248,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.5)_1px,transparent_1px)] bg-[size:28px_28px]" />
      {portrait ? (
        <>
          {/* Hologram: the full silhouette, ghostly */}
          <img src={portrait} alt="" className={`absolute inset-0 w-full h-full object-cover object-top mix-blend-screen ${
            hero.blueprint ? 'opacity-25 grayscale brightness-150 hue-rotate-[170deg]' : 'opacity-10 blur-md grayscale'
          }`} />
          {/* Printed part: full colour, revealed bottom-up */}
          <img src={portrait} alt={hero.name}
            className="absolute inset-0 w-full h-full object-cover object-top transition-[clip-path] duration-1000 ease-out"
            style={{ clipPath: `inset(${top} 0 0 0)` }} />
          {/* Print head */}
          {progress > 0 && progress < 1 && (
            <div className="absolute inset-x-0 h-[3px] warp-printhead transition-[top] duration-1000 ease-out"
              style={{ top, background: 'linear-gradient(90deg, transparent, #5eead4, #ffffff, #5eead4, transparent)', boxShadow: '0 0 18px 4px rgba(94,234,212,0.7)' }} />
          )}
        </>
      ) : (
        <Users className="absolute inset-0 m-auto w-1/3 h-1/3 text-slate-700" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
      {!hero.blueprint && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-8">
          <Lock className="w-10 h-10 text-slate-400" />
          <div className="font-orbitron font-bold text-slate-200">Blueprint missing</div>
          <div className="font-mono text-[12px] text-slate-400">Recover it from a Warp Archive or a boss wreck to start printing.</div>
        </div>
      )}
      {printing && <div className="absolute inset-0 warp-flash pointer-events-none" />}
      <div className="absolute top-3 left-3 font-mono text-[11px] tracking-[0.3em] text-teal-200/80">PRINT {Math.round(progress * 100)}%</div>
    </div>
  );
}

/**
 * Warp Beacon: heroes are warpcopied from a blueprint + 100 print materials.
 * Both are gathered on expeditions (Warp Archive nodes, boss victories).
 */
export default function WarpBeaconView({ onPrinted }) {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getWarpBeacon().then((d) => {
      setData(d);
      const pick = d.heroes.find((h) => h.ready) || d.heroes.find((h) => h.blueprint) || d.heroes[0];
      setSelectedId(pick?.template_id || null);
    }).catch((e) => setError(e.message));
  }, []);

  const lists = useMemo(() => {
    if (!data) return null;
    const byProgress = (a, b) => (b.ready - a.ready) || (b.materials - a.materials) || a.name.localeCompare(b.name);
    return {
      known: data.heroes.filter((h) => h.blueprint).sort(byProgress),
      unknown: data.heroes.filter((h) => !h.blueprint).sort(byProgress),
    };
  }, [data]);

  const warpcopy = async (hero) => {
    setBusy(true);
    setError(null);
    setPrinting(true);
    try {
      const res = await api.warpcopy(hero.template_id);
      await new Promise((r) => setTimeout(r, 650)); // let the flash play
      setData(res);
      setResult(res.champion);
      onPrinted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setPrinting(false);
    }
  };

  if (!data) {
    return (
      <div className="py-24 flex flex-col items-center gap-2 font-mono text-sm text-slate-500">
        {error ? <span className="text-red-400">{error}</span> : <><Loader2 className="w-6 h-6 animate-spin" /> Aligning the warp beacon…</>}
      </div>
    );
  }

  const cost = data.print_cost;
  const hero = data.heroes.find((h) => h.template_id === selectedId) || data.heroes[0];
  const tone = factionTone(hero.faction);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hud-panel rounded-2xl border border-sky-500/25 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-gradient-to-b from-sky-500 to-indigo-900 border border-sky-300/60 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </span>
          <div>
            <div className="font-mono text-[12px] tracking-[0.3em] text-sky-300">HERO WARPCOPY</div>
            <h2 className="font-orbitron font-black text-2xl text-slate-100">Warp Beacon</h2>
            <p className="font-mono text-[13px] text-slate-400">
              A blueprint plus {cost} print materials warpcopies a hero. Find both at <Satellite className="inline w-3.5 h-3.5 text-sky-300" /> Warp Archive nodes and in boss wrecks.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 px-3 py-1.5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-sky-400/80">BLUEPRINTS</div>
            <div className="font-orbitron font-black text-lg text-sky-200 flex items-center gap-1.5"><FileCode2 className="w-4 h-4" />{data.blueprints}/{data.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-emerald-400/80">READY TO PRINT</div>
            <div className="font-orbitron font-black text-lg text-emerald-300">{data.heroes.filter((h) => h.ready).length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Blueprint list */}
        <aside className="hud-panel rounded-2xl border border-sky-500/20 p-3 lg:max-h-[calc(100vh-260px)] overflow-y-auto space-y-2">
          <div className="font-mono text-[11px] tracking-[0.3em] text-slate-400 px-1">BLUEPRINTS ({lists.known.length})</div>
          {lists.known.length === 0 && (
            <p className="font-mono text-[12px] text-slate-500 px-1">No blueprint yet — explore Warp Archive nodes and defeat bosses.</p>
          )}
          {lists.known.map((h) => (
            <BlueprintRow key={h.template_id} hero={h} cost={cost} selected={h.template_id === hero.template_id} onSelect={setSelectedId} />
          ))}
          {lists.unknown.length > 0 && (
            <>
              <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500 px-1 pt-2">UNDISCOVERED ({lists.unknown.length})</div>
              {lists.unknown.map((h) => (
                <BlueprintRow key={h.template_id} hero={h} cost={cost} selected={h.template_id === hero.template_id} onSelect={setSelectedId} />
              ))}
            </>
          )}
        </aside>

        {/* Print chamber */}
        <section className="hud-panel rounded-2xl border border-sky-500/20 p-5 grid grid-cols-1 md:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
          <PrintChamber hero={hero} cost={cost} printing={printing} />
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[12px] tracking-[0.3em]" style={{ color: RARITY_COLOR[hero.rarity] }}>{hero.blueprint ? hero.rarity.toUpperCase() : 'CLASSIFIED'}</div>
              <h3 className="font-orbitron font-black text-3xl text-white leading-tight">{hero.blueprint ? hero.name : 'Unknown hero'}</h3>
              {hero.blueprint && <div className="font-mono text-[14px] text-slate-400">{hero.title}</div>}
              {hero.blueprint && (
                <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[12px]">
                  <span className={`px-2 py-0.5 rounded border ${tone.border} ${tone.text} bg-black/40`}>{hero.faction}</span>
                  <span className="px-2 py-0.5 rounded border border-slate-600 text-slate-300 bg-black/40">{hero.role}</span>
                  <span className="px-2 py-0.5 rounded border border-slate-600 text-slate-300 bg-black/40">Owned ×{hero.owned}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="flex items-center justify-between font-mono text-[12px]">
                <span className="flex items-center gap-1.5 text-slate-300"><FileCode2 className="w-4 h-4 text-sky-300" /> Blueprint</span>
                <span className={hero.blueprint ? 'text-emerald-300' : 'text-slate-500'}>{hero.blueprint ? 'ARCHIVED' : 'MISSING'}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[12px]">
                <span className="flex items-center gap-1.5 text-slate-300"><Atom className="w-4 h-4 text-teal-300" /> Print materials</span>
                <span className="text-teal-200 tabular-nums">{hero.materials} / {cost}</span>
              </div>
              <ProgressBar value={hero.materials} max={cost} ready={hero.ready} />
            </div>

            <button
              disabled={!hero.ready || busy}
              onClick={() => warpcopy(hero)}
              className="w-full px-6 py-4 rounded-xl font-orbitron font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition bg-gradient-to-r from-sky-500 to-teal-400 text-black hover:from-sky-400 hover:to-teal-300 shadow-[0_0_30px_rgba(45,212,191,0.35)] disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {hero.ready ? 'Warpcopy' : !hero.blueprint ? 'Blueprint required' : `${cost - hero.materials} more materials`}
            </button>
            {error && <div className="font-mono text-[13px] text-red-400">{error}</div>}

            {result && (
              <div key={result.id} className="panel-enter rounded-xl border-2 border-emerald-400/70 bg-emerald-950/40 p-3 flex items-center gap-3">
                <img src={getPortrait(result.name)} alt="" className="w-14 h-14 rounded-lg object-cover object-top border border-emerald-300/60" />
                <div>
                  <div className="font-mono text-[11px] tracking-[0.3em] text-emerald-300 flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> WARPCOPY COMPLETE</div>
                  <div className="font-orbitron font-black text-lg text-white">{result.name}</div>
                  <div className="font-mono text-[12px] text-slate-300">Joined your roster — level 1. Gear them up in the Armory.</div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
