import React, { useEffect, useMemo, useState } from 'react';
import {
  Factory, Building2, FlaskConical, Lock, Check, Coins, Gem, Users, Heart, Swords, Shield, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { factionTone, getTroopArt } from '../utils/battleVisuals';

const FACTION_META = {
  'Terran Vanguard': { short: 'TERRAN', hall: 'Dominion Barracks', accent: '#38bdf8' },
  'Bio-Swarm': { short: 'ZERG', hall: 'Hive Cluster', accent: '#c084fc' },
  'Astral Templars': { short: 'PROTOSS', hall: 'Warp Nexus', accent: '#fbbf24' },
};
const BONUS_LABEL = { attack: 'ATK', hp: 'HP', defense: 'DEF' };

function pctText(v) {
  return `+${Math.round(v * 100)}%`;
}

function CostTag({ cost, player, qty = 1 }) {
  const cr = cost.credits * qty;
  const cy = cost.crystals * qty;
  const okCr = (player?.credits ?? 0) >= cr;
  const okCy = (player?.crystals ?? 0) >= cy;
  return (
    <span className="flex items-center gap-2 font-mono text-[13px]">
      <span className={`flex items-center gap-1 ${okCr ? 'text-amber-300' : 'text-red-400'}`}><Coins className="w-3.5 h-3.5" />{cr.toLocaleString()}</span>
      {cy > 0 && <span className={`flex items-center gap-1 ${okCy ? 'text-cyan-300' : 'text-red-400'}`}><Gem className="w-3.5 h-3.5" />{cy}</span>}
    </span>
  );
}

const affordable = (cost, player, qty = 1) =>
  (player?.credits ?? 0) >= cost.credits * qty && (player?.crystals ?? 0) >= cost.crystals * qty;

/** Tier of a tech = 1 + deepest requirement, so the tree reads top → bottom. */
function tiers(upgrades) {
  const byId = Object.fromEntries(upgrades.map((u) => [u.id, u]));
  const memo = {};
  const depth = (id) => {
    if (memo[id] != null) return memo[id];
    const u = byId[id];
    memo[id] = 1 + Math.max(0, ...((u?.requires || []).filter((r) => byId[r]).map(depth)));
    return memo[id];
  };
  const rows = {};
  upgrades.forEach((u) => { (rows[depth(u.id)] ||= []).push(u); });
  return Object.keys(rows).sort().map((k) => rows[k]);
}

function TroopProduction({ troop, player, busy, onTrain, bonus }) {
  const tone = factionTone(troop.faction);
  const s = troop.stats;
  const boosted = (key) => Object.values(bonus).some((v) => v > 0) && (
    (key === 'volley' && bonus.attack > 0) || (key === 'hp' && bonus.hp > 0) || (key === 'defense' && bonus.defense > 0)
  );
  return (
    <div className={`relative rounded-2xl border-2 overflow-hidden bg-gradient-to-b from-[#0c1426] to-black flex flex-col ${troop.unlocked ? tone.border : 'border-slate-800'}`}>
      <div className="relative h-40 bg-black">
        <img src={getTroopArt({ template_id: troop.id, name: troop.name })} alt="" className={`w-full h-full object-cover ${troop.unlocked ? '' : 'grayscale opacity-40'}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <div className="absolute top-2 right-2 text-right">
          <div className="font-mono text-[10px] tracking-[0.25em] text-slate-300 [text-shadow:0_1px_3px_#000]">GARRISON</div>
          <div key={troop.owned} className="font-orbitron font-black text-4xl leading-none text-white [text-shadow:0_0_14px_rgba(0,0,0,0.9)] panel-enter">{troop.owned}</div>
        </div>
        <div className="absolute bottom-2 left-3 right-3">
          <div className="font-orbitron font-black text-xl text-white leading-tight">{troop.name}</div>
          <div className="font-mono text-[12px] text-slate-300">{troop.description}</div>
        </div>
        {!troop.unlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
            <Lock className="w-8 h-8 text-slate-300" />
            <span className="font-mono text-[13px] text-slate-200 text-center px-4">Requires {troop.missing.join(', ')}</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 grid grid-cols-4 gap-1 font-mono text-[13px] text-slate-300 border-b border-white/5">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{s.count}</span>
        <span className={`flex items-center gap-1 ${boosted('hp') ? 'text-emerald-300' : ''}`}><Heart className="w-3.5 h-3.5 text-emerald-400" />{s.hp}</span>
        <span className={`flex items-center gap-1 ${boosted('volley') ? 'text-emerald-300' : ''}`}><Swords className="w-3.5 h-3.5 text-red-400" />{s.volley}</span>
        <span className={`flex items-center gap-1 ${boosted('defense') ? 'text-emerald-300' : ''}`}><Shield className="w-3.5 h-3.5 text-sky-400" />{s.defense}</span>
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2 mt-auto">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-slate-500">PER PACK</div>
          <CostTag cost={troop.cost} player={player} />
          <div className="font-mono text-[11px] text-violet-300 mt-0.5 flex items-center gap-1"><Gem className="w-3 h-3" />{troop.mana_cost} mana to deploy</div>
        </div>
        <div className="flex gap-1.5">
          {[1, 5].map((q) => (
            <button
              key={q}
              disabled={!troop.unlocked || busy || !affordable(troop.cost, player, q)}
              onClick={() => onTrain(troop, q)}
              title={`Train ${q} pack${q > 1 ? 's' : ''}`}
              className="px-3 py-2 rounded-lg font-orbitron font-bold text-[12px] uppercase bg-gradient-to-b from-emerald-500 to-emerald-700 text-black hover:from-emerald-400 hover:to-emerald-600 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition"
            >
              Train ×{q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TechNode({ tech, player, busy, onResearch }) {
  const done = tech.status === 'done';
  const locked = tech.status === 'locked';
  const can = !done && !locked && affordable(tech.cost, player);
  const Icon = tech.kind === 'structure' ? Building2 : FlaskConical;
  return (
    <div className={`relative rounded-xl border-2 p-3 flex flex-col gap-1.5 transition ${
      done ? 'border-emerald-500/60 bg-emerald-950/25'
        : locked ? 'border-slate-800 bg-black/40 opacity-60'
        : 'border-cyan-500/40 bg-[#081426] hover:border-cyan-300'
    }`}>
      <div className="flex items-start gap-2">
        <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border ${done ? 'border-emerald-400 text-emerald-300 bg-emerald-950' : 'border-slate-600 text-slate-300 bg-black/60'}`}>
          {locked ? <Lock className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-orbitron font-bold text-[14px] text-slate-100 leading-tight">{tech.name}</div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-slate-500 uppercase">{tech.kind}</div>
        </div>
        {done && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
      </div>
      <p className="text-[13px] text-slate-300 leading-snug">{tech.description}</p>
      {Object.keys(tech.bonus || {}).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(tech.bonus).map(([k, v]) => (
            <span key={k} className="font-mono text-[11px] px-1.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-200">{BONUS_LABEL[k]} {pctText(v)}</span>
          ))}
        </div>
      )}
      {!done && (
        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          {locked
            ? <span className="font-mono text-[12px] text-slate-400">Needs {tech.missing.join(', ')}</span>
            : <CostTag cost={tech.cost} player={player} />}
          {!locked && (
            <button
              disabled={!can || busy}
              onClick={() => onResearch(tech)}
              className="px-3 py-1.5 rounded-lg font-orbitron font-bold text-[11px] uppercase bg-cyan-500 text-black hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              {tech.kind === 'structure' ? 'Build' : 'Research'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Barracks: build structures and research upgrades (per faction), then train troop packs
 * into the garrison. Expeditions draw their troop reserve from the garrison.
 */
export default function BarracksView({ onPlayerUpdated }) {
  const [data, setData] = useState(null);
  const [faction, setFaction] = useState('Terran Vanguard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api.getBarracks().then(setData).catch((e) => setError(e.message));
  }, []);

  const act = async (fn, message) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setData(res);
      onPlayerUpdated?.(res.player);
      setNotice({ key: Date.now(), text: message });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const view = useMemo(() => {
    if (!data) return null;
    return {
      troops: data.troops.filter((t) => t.faction === faction),
      tree: tiers(data.upgrades.filter((u) => u.faction === faction)),
      bonus: data.factions.find((f) => f.name === faction)?.bonus || {},
    };
  }, [data, faction]);

  if (!data) {
    return (
      <div className="py-24 flex flex-col items-center gap-2 font-mono text-sm text-slate-500">
        {error ? <span className="text-red-400">{error}</span> : <><Loader2 className="w-6 h-6 animate-spin" /> Connecting to production command…</>}
      </div>
    );
  }

  const player = data.player;
  const meta = FACTION_META[faction];
  const garrison = data.troops.filter((t) => t.owned > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hud-panel rounded-2xl border border-cyan-500/20 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-900 border border-emerald-400/60 flex items-center justify-center">
            <Factory className="w-6 h-6 text-white" />
          </span>
          <div>
            <div className="font-mono text-[12px] tracking-[0.3em] text-emerald-300">PRODUCTION COMMAND</div>
            <h2 className="font-orbitron font-black text-2xl text-slate-100">Barracks</h2>
            <p className="font-mono text-[13px] text-slate-400">Build structures, research upgrades, train troop packs. Expeditions draw their reserve from the garrison.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-1.5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-amber-400/80">CREDITS</div>
            <div className="font-orbitron font-black text-lg text-amber-300 flex items-center gap-1.5"><Coins className="w-4 h-4" />{player.credits.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-1.5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-400/80">CRYSTALS</div>
            <div className="font-orbitron font-black text-lg text-cyan-300 flex items-center gap-1.5"><Gem className="w-4 h-4" />{player.crystals.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-emerald-400/80">GARRISON</div>
            <div className="font-orbitron font-black text-lg text-emerald-300 flex items-center gap-1.5"><Users className="w-4 h-4" />{data.garrison} packs</div>
          </div>
        </div>
      </div>

      {/* Faction tabs */}
      <div className="flex flex-wrap gap-2">
        {data.factions.map((f) => {
          const m = FACTION_META[f.name];
          const tone = factionTone(f.name);
          const on = f.name === faction;
          const bonusText = Object.entries(f.bonus).filter(([, v]) => v > 0).map(([k, v]) => `${BONUS_LABEL[k]} ${pctText(v)}`).join(' · ');
          return (
            <button
              key={f.name}
              onClick={() => setFaction(f.name)}
              className={`flex-1 min-w-[200px] text-left rounded-xl border-2 px-4 py-2.5 transition ${on ? `${tone.border} ${tone.bg}` : 'border-slate-800 bg-black/30 hover:border-slate-600'}`}
              style={on ? { boxShadow: `0 0 24px ${m.accent}33` } : undefined}
            >
              <div className={`font-orbitron font-black text-lg ${on ? tone.text : 'text-slate-300'}`}>{m.short}</div>
              <div className="font-mono text-[12px] text-slate-400">{m.hall}{bonusText ? ` · ${bonusText}` : ''}</div>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-lg border border-red-500/50 bg-red-950/40 px-3 py-2 font-mono text-[13px] text-red-200">{error}</div>}
      {notice && (
        <div key={notice.key} className="panel-enter rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 font-mono text-[13px] text-emerald-200">{notice.text}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-4">
        {/* Production */}
        <section className="hud-panel rounded-2xl border border-cyan-500/20 p-4">
          <h3 className="font-orbitron font-bold text-sm text-slate-100 tracking-widest mb-3">PRODUCTION — {meta.hall.toUpperCase()}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {view.troops.map((t) => (
              <TroopProduction
                key={t.id}
                troop={t}
                player={player}
                busy={busy}
                bonus={view.bonus}
                onTrain={(troop, q) => act(() => api.trainTroops(troop.id, q), `${q}× ${troop.name} trained and sent to the garrison.`)}
              />
            ))}
          </div>
        </section>

        {/* Tech tree */}
        <section className="hud-panel rounded-2xl border border-cyan-500/20 p-4">
          <h3 className="font-orbitron font-bold text-sm text-slate-100 tracking-widest mb-3">TECH TREE</h3>
          <div className="space-y-2">
            {view.tree.map((row, i) => (
              <div key={i}>
                {i > 0 && <div className="flex justify-center py-0.5"><ChevronRight className="w-4 h-4 rotate-90 text-slate-600" /></div>}
                <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500 mb-1">TIER {i + 1}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {row.map((u) => (
                    <TechNode
                      key={u.id}
                      tech={u}
                      player={player}
                      busy={busy}
                      onResearch={(tech) => act(() => api.researchUpgrade(tech.id), `${tech.name} ${tech.kind === 'structure' ? 'constructed' : 'researched'}.`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Whole garrison */}
      <section className="hud-panel rounded-2xl border border-cyan-500/20 p-4">
        <h3 className="font-orbitron font-bold text-sm text-slate-100 tracking-widest mb-2">GARRISON — READY FOR DEPLOYMENT</h3>
        {garrison.length ? (
          <div className="flex flex-wrap gap-2">
            {garrison.map((t) => {
              const tone = factionTone(t.faction);
              return (
                <div key={t.id} className={`flex items-center gap-2 rounded-xl border ${tone.border} bg-black/40 pr-3`}>
                  <img src={getTroopArt({ template_id: t.id, name: t.name })} alt="" className="w-12 h-12 rounded-l-xl object-cover" />
                  <div>
                    <div className="font-orbitron font-bold text-[13px] text-slate-100">{t.name}</div>
                    <div className={`font-mono text-[12px] ${tone.text}`}>×{t.owned} packs</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-[13px] text-slate-500">No troops trained yet — expeditions will launch with heroes only.</p>
        )}
      </section>
    </div>
  );
}
