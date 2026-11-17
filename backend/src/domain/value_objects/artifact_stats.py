"""
Artifact stat rules (RSL-style, simplified).

* Rank 1-6 (stars) scales every value; rarity sets how many substats it starts with.
* Level 0 -> 16. Each level grows the main stat.
* Levels 4 / 8 / 12 / 16: add a new substat while fewer than 4, otherwise boost a random one.
* Upgrades cost credits (paid even on failure) and get riskier as the level rises.

Stat keys: flat `hp`, `attack`, `defense`, `speed`, `shields`, `accuracy`, `resistance`;
percent `hp_pct`, `attack_pct`, `defense_pct`; additive `crit_rate`, `crit_damage`.
"""
import random
from typing import Dict, List, Optional, Tuple

from src.domain.value_objects.enums import ArtifactSlot, Rarity

MAX_LEVEL = 16
MAX_SUBSTATS = 4
MILESTONES = (4, 8, 12, 16)

RANK_MULT = {1: 0.45, 2: 0.55, 3: 0.65, 4: 0.75, 5: 0.88, 6: 1.0}

# Main stat value at level 0 for a 6-star artifact; grows by MAIN_GROWTH per level.
MAIN_BASE = {
    "attack": 8, "hp": 60, "defense": 6, "speed": 4, "shields": 30,
    "attack_pct": 0.05, "hp_pct": 0.05, "defense_pct": 0.05,
    "crit_rate": 0.03, "crit_damage": 0.04,
    "accuracy": 12, "resistance": 12,
}
MAIN_GROWTH = 0.25  # +25% of base per level -> x5 at +16

SLOT_MAIN_STATS: Dict[ArtifactSlot, List[str]] = {
    ArtifactSlot.WEAPON: ["attack"],
    ArtifactSlot.HELMET: ["hp"],
    ArtifactSlot.ARMOR: ["defense"],
    ArtifactSlot.BOOTS: ["speed", "attack_pct", "hp_pct", "defense_pct"],
    ArtifactSlot.IMPLANT: ["crit_rate", "crit_damage", "attack_pct", "hp_pct", "defense_pct", "accuracy"],
    ArtifactSlot.CORE: ["shields", "attack_pct", "hp_pct", "defense_pct", "resistance"],
}

# One substat roll range for a 6-star artifact.
SUB_ROLL = {
    "hp": (20, 35), "attack": (3, 6), "defense": (3, 5), "speed": (1, 3),
    "attack_pct": (0.02, 0.04), "hp_pct": (0.02, 0.04), "defense_pct": (0.02, 0.04),
    "crit_rate": (0.02, 0.04), "crit_damage": (0.03, 0.06),
    "accuracy": (6, 11), "resistance": (6, 11),
}

STARTING_SUBSTATS = {Rarity.COMMON: 0, Rarity.RARE: 1, Rarity.EPIC: 2, Rarity.LEGENDARY: 3}

# Chance to succeed when upgrading FROM level N (index) to N+1.
UPGRADE_CHANCE = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25]

PERCENT_STATS = {"attack_pct", "hp_pct", "defense_pct", "crit_rate", "crit_damage"}


def is_percent(stat: str) -> bool:
    return stat in PERCENT_STATS


def _round(stat: str, value: float) -> float:
    return round(value, 3) if is_percent(stat) else int(round(value))


def main_value(stat: str, rank: int, level: int) -> float:
    base = MAIN_BASE.get(stat, 5) * RANK_MULT.get(rank, 0.88)
    return _round(stat, base * (1 + MAIN_GROWTH * level))


def roll_sub_value(stat: str, rank: int, rng: random.Random) -> float:
    lo, hi = SUB_ROLL[stat]
    mult = RANK_MULT.get(rank, 0.88)
    raw = rng.uniform(lo, hi) if is_percent(stat) else rng.randint(lo, hi)
    return _round(stat, max(raw * mult, 0.01 if is_percent(stat) else 1))


def pick_new_substat(main_stat: str, existing: List[str], rng: random.Random) -> Optional[str]:
    pool = [s for s in SUB_ROLL if s != main_stat and s not in existing]
    return rng.choice(pool) if pool else None


def upgrade_cost(rank: int, level: int) -> int:
    """Credits to attempt level -> level+1."""
    return int(250 * (level + 1) * (0.5 + rank / 4))


def upgrade_chance(level: int) -> float:
    return UPGRADE_CHANCE[level] if 0 <= level < len(UPGRADE_CHANCE) else 0.0


def pick_main_stat(slot: ArtifactSlot, rng: random.Random) -> str:
    return rng.choice(SLOT_MAIN_STATS[slot])


def roll_substats(main_stat: str, rarity: Rarity, rank: int, rng: random.Random) -> List[Dict]:
    subs: List[Dict] = []
    for _ in range(STARTING_SUBSTATS.get(rarity, 0)):
        stat = pick_new_substat(main_stat, [s["stat"] for s in subs], rng)
        if stat:
            subs.append({"stat": stat, "value": roll_sub_value(stat, rank, rng), "rolls": 1})
    return subs


def milestone_roll(main_stat: str, subs: List[Dict], rank: int, rng: random.Random) -> Tuple[str, Dict]:
    """At +4/+8/+12/+16: add a substat if room, else boost one. Returns (kind, substat)."""
    if len(subs) < MAX_SUBSTATS:
        stat = pick_new_substat(main_stat, [s["stat"] for s in subs], rng)
        if stat:
            sub = {"stat": stat, "value": roll_sub_value(stat, rank, rng), "rolls": 1}
            subs.append(sub)
            return "added", sub
    sub = rng.choice(subs)
    sub["value"] = _round(sub["stat"], sub["value"] + roll_sub_value(sub["stat"], rank, rng))
    sub["rolls"] = sub.get("rolls", 1) + 1
    return "boosted", sub
