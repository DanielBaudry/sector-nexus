import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crosshair, Swords } from 'lucide-react';
import { api } from '../services/api';
import Starfield from '../components/space/Starfield';
import PlanetGlobe from '../components/space/PlanetGlobe';
import PlanetView from './PlanetView';

const TRAVEL_MS = 750;

/** Small tinted planet for the system strip. */
function PlanetThumb({ planet, size = 44 }) {
  return (
    <img
      src={planet.image}
      alt=""
      draggable={false}
      style={{ width: size, height: size, filter: planet.image_hue ? `hue-rotate(${planet.image_hue}deg)` : undefined }}
      className="object-contain shrink-0"
    />
  );
}

/**
 * Sector Map: a starfield with the selected planet on the left and its info (expeditions +
 * hierarchy) on the right. Switch planets with the system strip, the arrows or ← / →:
 * the camera "jumps" — stars streak, the old planet flies off and the new one arrives from depth.
 */
export default function ExpeditionMapView({ biomes = [], squads, champions = [], activeRun, onStartCombat }) {
  const [index, setIndex] = useState(() => {
    const i = biomes.findIndex((b) => b.id === activeRun?.biome_id);
    return i >= 0 ? i : 0;
  });
  const [leaving, setLeaving] = useState(null);    // { planet, dir } — the planet flying away
  const [dir, setDir] = useState(1);
  const [warpKey, setWarpKey] = useState(0);
  const [hierarchies, setHierarchies] = useState({});
  const timer = useRef(null);
  const currentSquad = squads?.[0] || { id: 'squad_alpha' };
  const runInProgress = activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);
  const planet = biomes[index];

  useEffect(() => {
    biomes.forEach((b) => {
      api.getHierarchy(b.id).then((h) => setHierarchies((prev) => ({ ...prev, [b.id]: h }))).catch(() => {});
    });
  }, [biomes]);

  const goTo = useCallback((next, direction) => {
    if (!biomes.length || next === index) return;
    const wrapped = (next + biomes.length) % biomes.length;
    const d = direction ?? (wrapped > index ? 1 : -1);
    setLeaving({ planet: biomes[index], dir: d });
    setDir(d);
    setIndex(wrapped);
    setWarpKey((k) => k + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), TRAVEL_MS);
  }, [biomes, index]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Keyboard: ← / → travel between planets (ignored while typing or inside dialogs).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') goTo(index + 1, 1);
      if (e.key === 'ArrowLeft') goTo(index - 1, -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index]);

  if (!planet) return null;

  return (
    <div className="relative h-full min-h-0">
      <Starfield tint={planet.color} warpKey={warpKey} warpDir={dir} />

      <div className="relative z-10 h-full min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(460px,44%)] gap-4">
        {/* ── Stage: planet + system strip ── */}
        <div className="relative flex flex-col min-h-[420px] lg:min-h-0">
          <div className="relative flex-1 min-h-0 flex items-center justify-center">
            {leaving && (
              <div key={`out-${leaving.planet.id}-${warpKey}`} className={`absolute w-[min(78%,62vh)] planet-exit-${leaving.dir > 0 ? 'left' : 'right'}`}>
                <PlanetGlobe planet={leaving.planet} />
              </div>
            )}
            <div key={`in-${planet.id}`} className={`relative w-[min(78%,62vh)] ${leaving ? `planet-enter-${dir > 0 ? 'right' : 'left'}` : ''}`}>
              <PlanetGlobe planet={planet} />
            </div>

            {/* Prev / next */}
            {biomes.length > 1 && (
              <>
                <button onClick={() => goTo(index - 1, -1)} title="Previous planet (←)"
                  className="absolute left-0 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/70 hover:bg-cyan-950/40 backdrop-blur-sm transition">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={() => goTo(index + 1, 1)} title="Next planet (→)"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/70 hover:bg-cyan-950/40 backdrop-blur-sm transition">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Planet label over the stage */}
            <div key={`label-${planet.id}`} className="planet-label absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <div className="font-mono text-[11px] tracking-[0.4em] text-slate-400">PLANET {index + 1} / {biomes.length}</div>
              <div className="font-orbitron font-black text-2xl tracking-widest text-white" style={{ textShadow: `0 0 18px ${planet.color}` }}>
                {planet.name.split(':')[0].toUpperCase()}
              </div>
            </div>
          </div>

          {/* System strip */}
          <div className="shrink-0 flex justify-center gap-2 pt-2 overflow-x-auto">
            {biomes.map((b, i) => {
              const active = i === index;
              const h = hierarchies[b.id];
              const target = h?.champions?.find((c) => c.id === h.target_id);
              const here = runInProgress && activeRun.biome_id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => goTo(i)}
                  className={`group flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border backdrop-blur-sm transition ${
                    active ? 'bg-white/10 border-white/40' : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                  style={active ? { boxShadow: `0 0 18px ${b.color}55`, borderColor: `${b.color}aa` } : undefined}
                >
                  <PlanetThumb planet={b} size={active ? 40 : 34} />
                  <span className="text-left">
                    <span className={`block font-orbitron font-bold text-[12px] leading-tight ${active ? 'text-white' : 'text-slate-300'}`}>
                      {b.name.split(':')[0]}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                      {here ? (
                        <><Swords className="w-3 h-3 text-red-400" /> RUN ACTIVE</>
                      ) : target ? (
                        <><Crosshair className="w-3 h-3 text-cyan-300" /> {target.name}</>
                      ) : (
                        <>PWR {b.recommended_power}</>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Info panel ── */}
        <div key={`panel-${planet.id}`} className="panel-enter min-h-0 lg:overflow-y-auto rounded-2xl border border-white/10 bg-[#050811]/70 backdrop-blur-md p-5 shadow-2xl"
          style={{ boxShadow: `0 0 40px ${planet.color}1f, inset 0 1px 0 #ffffff12` }}>
          <PlanetView
            biome={planet}
            squad={currentSquad}
            champions={champions}
            activeRun={activeRun}
            onStartCombat={onStartCombat}
          />
        </div>
      </div>
    </div>
  );
}
