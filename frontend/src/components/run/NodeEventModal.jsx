import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Gem, Sparkles, Heart, Users, ArrowRight, Check } from 'lucide-react';
import { NODE_STYLE } from './RunNodeMap';
import { HeroLootList } from './HeroLoot';
import ArtifactCard from '../ArtifactCard';
import { getPortrait, getTroopArt } from '../../utils/battleVisuals';

function Tile({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center">
      <Icon className={`w-5 h-5 mx-auto ${color}`} />
      <div className={`font-orbitron font-black text-xl ${color}`}>{value}</div>
      <div className="font-mono text-[11px] text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function Recovery({ rows, kind }) {
  if (!rows?.length) return null;
  return (
    <div>
      <div className="font-mono text-[12px] tracking-widest text-slate-400 mb-1.5">{kind === 'hero' ? 'HEROES PATCHED UP' : 'TROOPS REGROUPED'}</div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const img = kind === 'hero' ? getPortrait(r.name) : getTroopArt({ name: r.name });
          const pctBefore = (r.before / Math.max(1, r.max)) * 100;
          const pctAfter = (r.after / Math.max(1, r.max)) * 100;
          return (
            <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/40 p-1.5">
              <img src={img} alt="" className="w-9 h-9 rounded-md object-cover object-top bg-black" onError={(e) => { e.target.style.display = 'none'; }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between font-mono text-[12px]">
                  <span className="text-slate-100 truncate">{r.name}</span>
                  <span className="text-emerald-300 tabular-nums flex items-center gap-1">
                    {r.before} <ArrowRight className="w-3 h-3" /> {r.after}{kind === 'troop' ? ` / ${r.max}` : ''}
                    {r.after > r.before && <span className="text-emerald-400">(+{r.after - r.before})</span>}
                  </span>
                </div>
                <div className="relative mt-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                  {/* Bright segment = what this camp restored */}
                  <div className="absolute inset-y-0 left-0 bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" style={{ width: `${pctAfter}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-emerald-700" style={{ width: `${pctBefore}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Outcome of a non-combat node (field camp, supply cache, warp archive): what was gained
 * or what happened, acknowledged with a confirm button.
 */
export default function NodeEventModal({ event, names, onConfirm, onArtifact, paused = false }) {
  useEffect(() => {
    if (paused) return undefined;  // an artifact sheet is open on top
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onConfirm(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, paused]);

  const style = NODE_STYLE[event.type] || NODE_STYLE.CACHE;
  const Icon = style.icon;
  const loot = event.loot || {};
  const currencies = [
    loot.credits > 0 && { icon: Coins, label: 'Credits', value: `+${loot.credits}`, color: 'text-amber-300' },
    loot.crystals > 0 && { icon: Gem, label: 'Crystals', value: `+${loot.crystals}`, color: 'text-cyan-300' },
    loot.champion_xp > 0 && { icon: Sparkles, label: 'Champion XP', value: `+${loot.champion_xp}`, color: 'text-purple-300' },
    event.mana > 0 && { icon: Gem, label: 'Mana', value: `+${event.mana}`, color: 'text-violet-300' },
  ].filter(Boolean);
  const hasLoot = currencies.length > 0 || loot.artifacts?.length > 0 || loot.blueprints?.length > 0
    || Object.keys(loot.hero_materials || {}).length > 0;
  const nothing = !currencies.length && !loot.artifacts?.length && !loot.blueprints?.length
    && !Object.keys(loot.hero_materials || {}).length && !event.healed?.length && !event.regrouped?.length;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="panel-enter w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border-2 p-6 space-y-4"
        style={{ borderColor: `${style.color}99`, background: 'rgba(6, 11, 24, 0.97)', boxShadow: `0 0 50px ${style.color}33, 0 30px 80px rgba(0,0,0,0.8)` }}
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center border-2 mb-2"
            style={{ borderColor: style.color, background: `${style.color}22`, boxShadow: `0 0 24px ${style.color}55` }}>
            <Icon className="w-8 h-8" style={{ color: style.color }} />
          </div>
          <div className="font-mono text-[12px] tracking-[0.3em]" style={{ color: style.color }}>{style.label.toUpperCase()}</div>
          <h3 className="font-orbitron font-black text-2xl text-white">{event.title}</h3>
          <p className="mt-1 text-[14px] text-slate-300 leading-relaxed">{event.description}</p>
        </div>

        {currencies.length > 0 && (
          <div className={`grid gap-2 ${['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][Math.min(4, currencies.length) - 1]}`}>
            {currencies.map((c) => <Tile key={c.label} {...c} />)}
          </div>
        )}

        {loot.artifacts?.length > 0 && (
          <div>
            <div className="font-mono text-[12px] tracking-widest text-slate-400 mb-1.5">ARTIFACTS RECOVERED</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {loot.artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} compact onClick={onArtifact ? () => onArtifact(a) : undefined} />)}
            </div>
          </div>
        )}

        <HeroLootList rewards={loot} names={names} title="Warp data recovered" />
        <Recovery rows={event.healed} kind="hero" />
        <Recovery rows={event.regrouped} kind="troop" />
        {nothing && <p className="text-center font-mono text-[13px] text-slate-500">Nothing of value here.</p>}

        {hasLoot && <p className="text-center font-mono text-[12px] text-slate-500">Loot is banked when the expedition ends — extracting early keeps half.</p>}
        <button
          autoFocus
          onClick={onConfirm}
          className="w-full py-3 rounded-xl font-orbitron font-black text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 hover:brightness-110"
          style={{ background: style.color }}
        >
          <Check className="w-5 h-5" /> Confirm
        </button>
      </div>
    </div>,
    document.body,
  );
}
