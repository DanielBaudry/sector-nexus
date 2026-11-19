import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Gem, X, Heart, Swords, Shield, Users, MapPin, Lock } from 'lucide-react';
import { LANE_NAMES, factionTone, getTroopArt } from '../../utils/battleVisuals';

const SHORT_LANES = ['LEFT', 'CENTER', 'RIGHT'];

/** Mana crystal cost chip. */
export function ManaCost({ cost, affordable = true, size = 'md' }) {
  const big = size === 'lg';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border-2 font-orbitron font-black ${
        big ? 'px-2 py-0.5 text-lg' : 'px-1.5 text-sm'
      } ${affordable ? 'border-violet-300/80 bg-violet-950/90 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.55)]' : 'border-red-500/70 bg-red-950/90 text-red-200'}`}
    >
      <Gem className={big ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {cost}
    </span>
  );
}

/**
 * The player's mana reserve, docked in the bottom-left corner of the battle.
 * The crystal fills with mana; a pip ring shows the cap. Click to open the troop reserve.
 */
export function ManaOrb({ mana, cap, reserve, ready, pulse, onClick, open }) {
  const fill = Math.max(0, Math.min(1, mana / Math.max(1, cap)));
  const affordable = reserve.some((t) => t.mana_cost <= mana);
  const glowing = ready && affordable;
  const pips = Array.from({ length: cap }, (_, i) => i < mana);
  return (
    <button
      onClick={onClick}
      title="Mana & troop reserve [M]"
      className={`group relative flex flex-col items-center gap-1 select-none ${open ? 'scale-105' : ''} transition-transform`}
    >
      {/* +N pop on every gain */}
      {pulse && pulse.amount > 0 && (
        <span key={`pop-${pulse.key}`} className="mana-pop absolute -top-5 left-1/2 -translate-x-1/2 font-orbitron font-black text-xl text-violet-200 [text-shadow:0_0_10px_rgba(139,92,246,0.9),0_1px_2px_#000] pointer-events-none">
          +{pulse.amount}
        </span>
      )}
      <span
        key={`orb-${pulse?.key ?? 0}`}
        className={`relative w-[104px] h-[104px] rounded-full p-[5px] ${pulse?.amount > 0 ? 'mana-gain' : ''}`}
        style={{
          background: `conic-gradient(${pips.map((on, i) => {
            const a = (i / cap) * 360;
            const b = ((i + 1) / cap) * 360 - 4;
            return `${on ? '#a78bfa' : '#1e1b3a'} ${a}deg ${b}deg, transparent ${b}deg ${((i + 1) / cap) * 360}deg`;
          }).join(', ')})`,
        }}
      >
        {glowing && <span className="absolute inset-0 rounded-full mana-ready pointer-events-none" />}
        <span className="relative block w-full h-full rounded-full overflow-hidden border-2 border-violet-300/60 bg-[#0b0820] shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
          {/* liquid mana level */}
          <span
            className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
            style={{
              height: `${fill * 100}%`,
              background: 'linear-gradient(to top, #4c1d95 0%, #7c3aed 55%, #a78bfa 100%)',
              boxShadow: '0 -2px 12px rgba(167,139,250,0.8)',
            }}
          />
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.35),transparent_40%)]" />
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-orbitron font-black text-[34px] leading-none text-white [text-shadow:0_0_12px_rgba(167,139,250,0.9),0_2px_3px_#000] tabular-nums">{mana}</span>
            <span className="font-mono text-[11px] text-violet-100/80 [text-shadow:0_1px_2px_#000]">/ {cap}</span>
          </span>
        </span>
        {reserve.length > 0 && (
          <span className={`absolute -top-0.5 -right-1 min-w-[26px] h-[26px] px-1 rounded-full border-2 flex items-center justify-center font-orbitron font-black text-[13px] ${
            glowing ? 'bg-emerald-500 border-emerald-200 text-black' : 'bg-black border-violet-400/60 text-violet-100'
          }`} title={`${reserve.length} pack(s) in reserve`}>
            {reserve.length}
          </span>
        )}
      </span>
      <span className={`font-mono text-[11px] tracking-[0.25em] uppercase ${glowing ? 'text-emerald-300' : 'text-violet-300/80'} group-hover:text-white`}>
        {glowing ? 'Deploy' : 'Mana'}
      </span>
    </button>
  );
}

function PackCard({ pack, mana, canDeploy, laneInfo, onDeploy, busy }) {
  const tone = factionTone(pack.faction);
  const affordable = pack.mana_cost <= mana;
  const usable = canDeploy && affordable && !busy;
  return (
    <div className={`relative rounded-2xl border-2 overflow-hidden bg-gradient-to-b from-[#0c1426] to-black flex flex-col transition ${
      affordable ? `${tone.border} hover:shadow-[0_0_24px_rgba(139,92,246,0.35)]` : 'border-slate-800 opacity-70'
    }`}>
      <div className="relative h-28 bg-black/60">
        <img src={getTroopArt(pack)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <span className="absolute top-2 right-2"><ManaCost cost={pack.mana_cost} affordable={affordable} size="lg" /></span>
        <span className="absolute bottom-1.5 left-2 right-2">
          <span className="block font-orbitron font-black text-[16px] text-white leading-tight truncate">{pack.name}</span>
          <span className={`block font-mono text-[12px] ${tone.text}`}>{pack.faction}</span>
        </span>
      </div>
      <div className="px-2.5 py-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[13px] text-slate-300">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{pack.count}/{pack.max_count}</span>
        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-emerald-400" />{pack.hp}</span>
        <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5 text-red-400" />{pack.volley_power}</span>
        <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-sky-400" />{pack.defense}</span>
      </div>
      <div className="mt-auto px-2 pb-2">
        {affordable ? (
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((lane) => (
              <button
                key={lane}
                disabled={!usable}
                onClick={() => onDeploy(pack, lane)}
                title={`Deploy to ${LANE_NAMES[lane]}`}
                className="rounded-lg border border-violet-400/50 bg-violet-950/60 py-1.5 font-orbitron font-bold text-[11px] text-violet-100 hover:bg-violet-600 hover:border-violet-200 hover:text-white disabled:opacity-35 disabled:hover:bg-violet-950/60 disabled:cursor-not-allowed transition"
              >
                {SHORT_LANES[lane]}
                <span className="block font-mono font-normal text-[10px] text-violet-300/80">{laneInfo[lane]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/40 py-2 font-mono text-[12px] text-red-200">
            <Lock className="w-3.5 h-3.5" /> {pack.mana_cost - mana} more mana needed
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Troop reserve: packs brought on the expedition, deployed into a lane for their mana cost.
 * Deployment is a free action during the player's turn; deployed packs hold their lane.
 */
export function ReserveModal({ open, onClose, mana, cap, reserve, onField, canDeploy, reason, laneInfo, onDeploy, busy }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="panel-enter w-full max-w-4xl max-h-[86vh] overflow-y-auto rounded-2xl border-2 border-violet-400/60 p-5 shadow-[0_0_60px_rgba(139,92,246,0.3),0_30px_80px_rgba(0,0,0,0.8)]"
        style={{ background: 'rgba(8, 7, 24, 0.97)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[12px] tracking-[0.3em] text-violet-300">TROOP RESERVE</div>
            <h3 className="font-orbitron font-black text-2xl text-white">Call in reinforcements</h3>
            <p className="font-mono text-[13px] text-slate-400 mt-1 max-w-xl">
              Free action during your turn. Deployed packs hold their lane until destroyed — they follow you into the next battles.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-mono text-[11px] tracking-[0.3em] text-violet-300/80">MANA</div>
              <div className="font-orbitron font-black text-3xl text-white leading-none tabular-nums">
                {mana}<span className="text-base text-violet-300/70"> / {cap}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="Close [Esc]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!canDeploy && (
          <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-2 font-mono text-[13px] text-amber-200">{reason}</div>
        )}

        {reserve.length ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reserve.map((p) => (
              <PackCard key={p.id} pack={p} mana={mana} canDeploy={canDeploy} laneInfo={laneInfo} onDeploy={onDeploy} busy={busy} />
            ))}
          </div>
        ) : (
          <div className="mt-6 mb-2 text-center font-mono text-sm text-slate-500">Reserve empty — every pack you brought is on the field.</div>
        )}

        {onField.length > 0 && (
          <div className="mt-5">
            <div className="font-mono text-[12px] tracking-widest text-slate-400 mb-1.5">ON THE FIELD</div>
            <div className="flex flex-wrap gap-1.5">
              {onField.map((p) => (
                <span key={p.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[12px] bg-black/40 ${factionTone(p.faction).border} text-slate-200`}>
                  <MapPin className="w-3.5 h-3.5 text-violet-300" /> {p.name} ×{p.count}
                  <span className="text-slate-500">· {LANE_NAMES[p.deployed_lane]}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
