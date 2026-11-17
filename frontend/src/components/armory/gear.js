import { Sword, Shield, HardHat, Footprints, Cpu, Atom } from 'lucide-react';

export const SLOTS = ['Weapon', 'Helmet', 'Armor', 'Boots', 'Neural Implant', 'Power Core'];

export const SLOT_ICONS = {
  Weapon: Sword,
  Armor: Shield,
  Helmet: HardHat,
  Boots: Footprints,
  'Neural Implant': Cpu,
  'Power Core': Atom,
};

const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };

export const SORTS = {
  rank: (a, b) => b.rank - a.rank || b.level - a.level || RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity],
  level: (a, b) => b.level - a.level || b.rank - a.rank,
  rarity: (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || b.rank - a.rank || b.level - a.level,
};

/** Flat map of every stat an artifact grants (main + substats). */
export function artifactTotals(artifact) {
  const totals = {};
  if (!artifact) return totals;
  totals[artifact.main_stat_name] = (totals[artifact.main_stat_name] || 0) + Number(artifact.main_stat_value || 0);
  (artifact.sub_stats || []).forEach((s) => {
    totals[s.stat] = (totals[s.stat] || 0) + Number(s.value || 0);
  });
  return totals;
}

/** Per-stat difference between a candidate and the currently equipped artifact. */
export function compareArtifacts(candidate, equipped) {
  const a = artifactTotals(candidate);
  const b = artifactTotals(equipped);
  const stats = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return stats
    .map((stat) => ({ stat, diff: (a[stat] || 0) - (b[stat] || 0) }))
    .filter((d) => Math.abs(d.diff) > 1e-6);
}
