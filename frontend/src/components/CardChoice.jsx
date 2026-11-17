import React from 'react';
import { Zap, Shield, Heart, Crosshair, Target, Swords, Bomb, Sun, Activity } from 'lucide-react';

export const SKILL_IMAGES = {
  'Penetrator Round': '/assets/skills/skill_penetrator.svg',
  'Hyperion Salvo': '/assets/skills/skill_orbital.svg',
  'Inspire Squad': '/assets/skills/skill_shield.svg',
  'C-20A Snipe': '/assets/skills/skill_snipe.svg',
  'EMP Shockwave': '/assets/skills/skill_psi_storm.svg',
  'Nanite Injection': '/assets/skills/skill_heal.svg',
  'Optical Flare': '/assets/skills/skill_snipe.svg',
  'Shock Cannon Blast': '/assets/skills/skill_orbital.svg',
  'Defensive Lockdown': '/assets/skills/skill_shield.svg',
  'Psionic Shift': '/assets/skills/skill_psi_storm.svg',
  'Crushing Grip': '/assets/skills/skill_penetrator.svg',
  'Biomass Harvest': '/assets/skills/skill_heal.svg',
  'Kaiser Blade Cleave': '/assets/skills/skill_twin_blades.svg',
  'Subterranean Slam': '/assets/skills/skill_penetrator.svg',
  'Apex Tongue Drag': '/assets/skills/skill_snipe.svg',
  'Essence Devour': '/assets/skills/skill_heal.svg',
  'Grooved Spine Salvo': '/assets/skills/skill_penetrator.svg',
  'Twin Psi-Blades': '/assets/skills/skill_twin_blades.svg',
  'Shield Overcharge': '/assets/skills/skill_shield.svg',
  'Orbital Solar Lance': '/assets/skills/skill_orbital.svg',
  'Psionic Storm': '/assets/skills/skill_psi_storm.svg',
  'Plasma Surge': '/assets/skills/skill_penetrator.svg',
  'Warp Blade Ambush': '/assets/skills/skill_twin_blades.svg',
  'Shadow Cleave': '/assets/skills/skill_twin_blades.svg',
  'Guardian Barrier': '/assets/skills/skill_shield.svg',
  'Chrono Beam': '/assets/skills/skill_snipe.svg',
};

// Color theme per card type
const CARD_THEME = {
  ATTACK: { glow: 'shadow-red-500/30 border-red-500/50 hover:border-red-400', accent: 'text-red-300', bg: 'from-[#1a060a] to-[#0d0308]', badge: 'bg-red-950 text-red-300 border-red-500/40' },
  HEAL:   { glow: 'shadow-emerald-500/30 border-emerald-500/50 hover:border-emerald-400', accent: 'text-emerald-300', bg: 'from-[#021a0a] to-[#010d05]', badge: 'bg-emerald-950 text-emerald-300 border-emerald-500/40' },
  SHIELD: { glow: 'shadow-cyan-500/30 border-cyan-500/50 hover:border-cyan-400', accent: 'text-cyan-300', bg: 'from-[#021220] to-[#010810]', badge: 'bg-cyan-950 text-cyan-300 border-cyan-500/40' },
  BUFF:   { glow: 'shadow-amber-500/30 border-amber-500/50 hover:border-amber-400', accent: 'text-amber-300', bg: 'from-[#1a1200] to-[#0d0900]', badge: 'bg-amber-950 text-amber-300 border-amber-500/40' },
};

function getCardTheme(card) {
  if (card.heal_multiplier > 0) return CARD_THEME.HEAL;
  if (card.shield_grant > 0) return CARD_THEME.SHIELD;
  if (card.target_type === 'ALL_ALLIES') return CARD_THEME.BUFF;
  return CARD_THEME.ATTACK;
}

export default function CardChoice({ card, index, onSelect, disabled }) {
  if (!card) return null;

  const skillImg = SKILL_IMAGES[card.name] || '/assets/skills/skill_penetrator.svg';
  const theme = getCardTheme(card);

  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(card.id)}
      className={`group relative flex flex-col rounded-xl border text-left transition-all duration-150 transform hover:-translate-y-1 active:translate-y-0 overflow-hidden w-full ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800'
          : `bg-gradient-to-b ${theme.bg} ${theme.glow} hover:shadow-lg`
      }`}
    >
      {/* BIG Skill Image — dominant visual */}
      <div className="relative w-full h-28 overflow-hidden bg-black/60">
        <img
          src={skillImg}
          alt={card.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        {/* Dark gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Hotkey badge — top left */}
        <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded bg-black/80 border border-cyan-400 text-cyan-300 font-mono text-[12px] flex items-center justify-center font-bold z-10">
          {index + 1}
        </span>

        {/* AP cost — top right */}
        <span className={`absolute top-1.5 right-1.5 font-mono text-[12px] font-bold px-1.5 py-0.5 rounded bg-black/80 border ${theme.badge} z-10`}>
          {card.energy_cost} AP
        </span>
      </div>

      {/* Card info block */}
      <div className="px-2 py-1.5 flex flex-col gap-0.5">
        <h4 className={`font-orbitron font-bold text-[13px] leading-tight ${theme.accent} group-hover:brightness-125 transition truncate`}>
          {card.name}
        </h4>

        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
          {card.description}
        </p>

        {/* Stat tags */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {card.power_multiplier > 0 && (
            <span className="px-1 py-px rounded bg-amber-950/80 text-amber-300 font-mono text-[10px] font-semibold border border-amber-500/30">
              {Math.round(card.power_multiplier * 100)}% ATK
            </span>
          )}
          {card.shield_grant > 0 && (
            <span className="px-1 py-px rounded bg-cyan-950/80 text-cyan-300 font-mono text-[10px] font-semibold border border-cyan-500/30">
              +{card.shield_grant} SHIELD
            </span>
          )}
          {card.heal_multiplier > 0 && (
            <span className="px-1 py-px rounded bg-emerald-950/80 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30">
              +{Math.round(card.heal_multiplier * 100)}% HEAL
            </span>
          )}
          <span className="text-slate-600 text-[10px] uppercase truncate">
            [{card.target_type.replace('_', ' ')}]
          </span>
        </div>
      </div>
    </button>
  );
}
