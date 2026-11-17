// Display helpers for champion / artifact progression.

const STAT_LABELS = {
  hp: 'HP', attack: 'ATK', defense: 'DEF', speed: 'SPD', shields: 'SHIELDS',
  hp_pct: 'HP%', attack_pct: 'ATK%', defense_pct: 'DEF%',
  crit_rate: 'C.RATE', crit_damage: 'C.DMG',
  accuracy: 'ACC', resistance: 'RES',
};

const PERCENT = new Set(['hp_pct', 'attack_pct', 'defense_pct', 'crit_rate', 'crit_damage']);

export function statLabel(stat) {
  return STAT_LABELS[stat] || String(stat).toUpperCase();
}

export function formatStat(stat, value) {
  if (PERCENT.has(stat)) return `+${Math.round(Number(value) * 1000) / 10}%`;
  return `+${Math.round(Number(value))}`;
}

export const RARITY_STYLE = {
  Common: { text: 'text-slate-300', border: 'border-slate-500/50', bg: 'bg-slate-900/70' },
  Rare: { text: 'text-sky-300', border: 'border-sky-500/60', bg: 'bg-sky-950/40' },
  Epic: { text: 'text-purple-300', border: 'border-purple-500/60', bg: 'bg-purple-950/40' },
  Legendary: { text: 'text-amber-300', border: 'border-amber-400/70', bg: 'bg-amber-950/40' },
};

export function rarityStyle(rarity) {
  return RARITY_STYLE[rarity] || RARITY_STYLE.Common;
}

export function portraitFor(name = '') {
  if (name.includes('Raynor')) return '/assets/characters/raynor.svg';
  if (name.includes('Nova')) return '/assets/characters/nova.svg';
  if (name.includes('Kerrigan')) return '/assets/characters/kerrigan_1.svg';
  if (name.includes('Artanis')) return '/assets/characters/artanis.svg';
  if (name.includes('Lisa')) return '/assets/characters/medic.svg';
  return null;
}

// Full-body character art (Armory). Only Zeratul has final art for now.
export const HERO_ART_PLACEHOLDER = '/assets/characters/full/placeholder.png';

export function heroArtFor(name = '') {
  if (name.includes('Zeratul')) return '/assets/characters/full/warrior.png';
  if (name.includes('Kerrigan')) return '/assets/characters/full/kerrigan.png';
  return HERO_ART_PLACEHOLDER;
}
