// Shared visual helpers for the expedition run / lane battle screens.

const PROFILE_IMAGES = {
  Raynor: '/assets/characters/raynor.jpg',
  Nova: '/assets/characters/nova.jpg',
  Kerrigan: '/assets/characters/kerrigan.jpg',
  Zeratul: '/assets/characters/zeratul.jpg',
  Artanis: '/assets/characters/artanis.svg',
  Lisa: '/assets/characters/medic.svg',
};

const BOSS_ART = {
  "Zar'gul": '/assets/bosses/zargul.svg',
};

export function getBossArt(name = '') {
  const key = Object.keys(BOSS_ART).find((k) => name.includes(k));
  return key ? BOSS_ART[key] : '/assets/troops/hostile.svg';
}

export function getPortrait(name = '') {
  const key = Object.keys(PROFILE_IMAGES).find((k) => name.includes(k));
  return key ? PROFILE_IMAGES[key] : null;
}

export function factionTone(faction = '') {
  if (faction.includes('Terran')) return { text: 'text-sky-300', border: 'border-sky-400/60', bg: 'bg-sky-950/60', dot: 'bg-sky-400' };
  if (faction.includes('Bio')) return { text: 'text-purple-300', border: 'border-purple-400/60', bg: 'bg-purple-950/60', dot: 'bg-purple-400' };
  if (faction.includes('Astral')) return { text: 'text-amber-300', border: 'border-amber-400/60', bg: 'bg-amber-950/60', dot: 'bg-amber-400' };
  return { text: 'text-cyan-300', border: 'border-cyan-400/60', bg: 'bg-cyan-950/60', dot: 'bg-cyan-400' };
}

export const LANE_NAMES = ['LEFT FLANK', 'CENTER', 'RIGHT FLANK'];

export const SCOPE_LABEL = {
  same_lane: 'LANE',
  adjacent_lanes: 'ADJACENT',
  any_lane: 'ANY LANE',
  all_lanes: 'ALL LANES',
};

/** Lanes an ability reaches from the hero's lane. ANY_LANE returns every lane (player picks one). */
export function lanesInReach(scope, originLane) {
  if (scope === 'all_lanes' || scope === 'any_lane') return [0, 1, 2];
  if (scope === 'adjacent_lanes') return [originLane - 1, originLane, originLane + 1].filter((l) => l >= 0 && l <= 2);
  return [originLane];
}

export function pct(value, max) {
  return Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
}

// ── Troop / hostile art ────────────────────────────────────────────────────
const TROOP_ART = {
  troop_marine: 'marine',
  troop_marauder: 'marauder',
  troop_zergling: 'zergling',
  troop_hydralisk: 'hydralisk',
  troop_zealot: 'zealot',
  troop_stalker: 'stalker',
};

// Enemy names come from biome pools; match the closest silhouette.
const HOSTILE_KEYWORDS = [
  ['zergling', 'zergling'], ['brood', 'zergling'], ['roach', 'hydralisk'], ['hydra', 'hydralisk'],
  ['ravager', 'hydralisk'], ['zealot', 'zealot'], ['stalker', 'stalker'], ['immortal', 'stalker'],
  ['marine', 'marine'], ['raider', 'marine'], ['firebat', 'marauder'], ['goliath', 'marauder'],
  ['marauder', 'marauder'],
];

export function getTroopArt(unit) {
  const byTemplate = TROOP_ART[unit.template_id];
  if (byTemplate) return `/assets/troops/${byTemplate}.svg`;
  const name = (unit.name || '').toLowerCase();
  const hit = HOSTILE_KEYWORDS.find(([kw]) => name.includes(kw));
  return `/assets/troops/${hit ? hit[1] : 'hostile'}.svg`;
}

// ── Battle projectiles ─────────────────────────────────────────────────────
// Close-combat units slash their target instead of firing a projectile.
const MELEE_KEYWORDS = [
  'zeratul', 'artanis', 'dehaka', 'torrasque', 'kerrigan', 'zealot', 'zergling', 'baneling',
  'ultralisk', 'ravager', 'skarn', 'morghast', 'grubhalk', 'packleader', 'pack',
];

/**
 * Visual style of a unit's attacks: bullet (Terran), glob (Zerg acid, arcs), psi (Protoss orb),
 * void (void-touched orb), boss (colossal fireball) or slash (melee).
 */
export function projectileStyleFor(unit) {
  if (!unit) return 'bullet';
  if (unit.spans_lanes) return 'boss';
  const name = (unit.name || '').toLowerCase();
  if (MELEE_KEYWORDS.some((k) => name.includes(k))) return 'slash';
  if (/void|hybrid|shade/.test(name)) return 'void';
  const f = unit.faction || '';
  if (f.includes('Terran')) return 'bullet';
  if (f.includes('Bio')) return 'glob';
  if (f.includes('Astral')) return 'psi';
  // Hostiles: match their look.
  const art = getTroopArt(unit);
  if (art.includes('marine') || art.includes('marauder')) return 'bullet';
  if (art.includes('stalker')) return 'psi';
  return 'glob';
}

/** Slash colour per allegiance / faction. */
export function slashColorFor(unit) {
  if (!unit) return '#f8fafc';
  if (unit.side === 'ENEMY') return '#f87171';
  const f = unit.faction || '';
  if (f.includes('Astral')) return '#67e8f9';
  if (f.includes('Bio')) return '#d8b4fe';
  return '#f8fafc';
}
