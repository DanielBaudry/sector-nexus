"""
Expedition difficulty tiers (1-10).

Each tier makes enemies stronger and pays more: bigger currency / XP rewards,
better artifact rarity odds, a higher chance of higher-rank artifacts and more drops.
Tiers 4, 8 and 10 also unlock new, more dangerous enemies (see Biome.difficulty_enemies).
Tier 10 will later accept modifiers; not implemented yet.
"""
from dataclasses import dataclass
from typing import Any, Dict, Tuple

MIN_DIFFICULTY = 1
MAX_DIFFICULTY = 10
THREAT_TIERS = (4, 8, 10)  # tiers that bring new enemies

# Per-tier multipliers applied to the base rarity weights (Common, Rare, Epic, Legendary).
_RARITY_TILT = (-0.08, 0.0, 0.15, 0.30)


@dataclass(frozen=True)
class Difficulty:
    tier: int = 1

    def __post_init__(self):
        if not MIN_DIFFICULTY <= self.tier <= MAX_DIFFICULTY:
            raise ValueError(f"Difficulty must be between {MIN_DIFFICULTY} and {MAX_DIFFICULTY}.")

    @property
    def step(self) -> int:
        return self.tier - 1

    @property
    def enemy_mult(self) -> float:
        """Enemy stat multiplier: x1 at tier 1, x3.25 at tier 10."""
        return 1.0 + 0.25 * self.step

    @property
    def reward_mult(self) -> float:
        """Credits / crystals / champion XP multiplier: x1 at tier 1, x2.8 at tier 10."""
        return 1.0 + 0.2 * self.step

    @property
    def drop_chance_bonus(self) -> float:
        """Added to the chance a node drops anything at all."""
        return 0.04 * self.step

    @property
    def extra_drop_chance(self) -> float:
        """Chance a dropping node yields one more artifact."""
        return 0.05 * self.step

    @property
    def rank_floor_bonus(self) -> int:
        """Flat artifact rank bonus from tier 6 on."""
        return 1 if self.tier >= 6 else 0

    @property
    def rank_up_chance(self) -> float:
        """Chance of +1 artifact rank on each drop."""
        return min(0.9, 0.1 * self.step)

    @property
    def extra_waves(self) -> int:
        """Additional reinforcement waves in regular fights."""
        return 0 if self.tier < 6 else (1 if self.tier < 9 else 2)

    def rarity_odds(self, base: Tuple[float, ...]) -> Tuple[float, ...]:
        weights = [max(0.0, w * (1 + tilt * self.step)) for w, tilt in zip(base, _RARITY_TILT)]
        total = sum(weights) or 1.0
        return tuple(w / total for w in weights)

    def to_dict(self, base_rarity: Tuple[float, ...] = (0.45, 0.38, 0.14, 0.03)) -> Dict[str, Any]:
        odds = self.rarity_odds(base_rarity)
        return {
            "tier": self.tier,
            "enemy_mult": round(self.enemy_mult, 2),
            "reward_mult": round(self.reward_mult, 2),
            "rarity_odds": {
                "Common": round(odds[0], 3), "Rare": round(odds[1], 3),
                "Epic": round(odds[2], 3), "Legendary": round(odds[3], 3),
            },
            "rank_bonus": self.rank_floor_bonus,
            "rank_up_chance": round(self.rank_up_chance, 2),
            "drop_chance_bonus": round(self.drop_chance_bonus, 2),
            "extra_drop_chance": round(self.extra_drop_chance, 2),
            "extra_waves": self.extra_waves,
            "new_threats": self.tier in THREAT_TIERS,
            "modifiers_available": self.tier == MAX_DIFFICULTY,  # coming later
        }
