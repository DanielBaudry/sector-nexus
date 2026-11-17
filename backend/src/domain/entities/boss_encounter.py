from dataclasses import dataclass, field
from typing import Any, Dict, List

from src.domain.value_objects.difficulty import Difficulty


@dataclass
class BossEncounter:
    """
    A standalone boss fight: one colossal boss standing across all three lanes
    against a squad of up to three heroes (and their troops).
    The boss uses cooldown abilities like a hero, telegraphs its heaviest attacks
    and changes phase at HP thresholds.
    """
    id: str
    name: str
    title: str
    description: str
    arena_biome_id: str           # loot table / artifact sets come from this biome
    arena_name: str
    image: str
    recommended_power: int
    hp: int
    attack: int
    defense: int
    speed: int
    shields: int = 0
    crit_rate: float = 0.10
    accuracy: int = 40
    resistance: int = 60
    # Ability dicts (CombatCard.from_dict) — may carry "telegraph_turns" and "phase".
    abilities: List[Dict[str, Any]] = field(default_factory=list)
    # Phase dicts: threshold (HP ratio that triggers it), name, description,
    # bonus {stat: pct}, effects [EffectSpec dicts on self], summons [{template_id, lanes}], shield_pct.
    phases: List[Dict[str, Any]] = field(default_factory=list)
    # Summonable add templates: template_id -> {name, count, unit_hp, unit_attack, defense}
    summons: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    passive: Dict[str, Any] = field(default_factory=dict)
    rewards: Dict[str, int] = field(default_factory=dict)  # base credits / crystals at difficulty 1
    max_difficulty: int = 10
    color: str = "#ef4444"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "arena_biome_id": self.arena_biome_id,
            "arena_name": self.arena_name,
            "image": self.image,
            "recommended_power": self.recommended_power,
            "color": self.color,
            "stats": {"hp": self.hp, "attack": self.attack, "defense": self.defense, "speed": self.speed},
            "abilities": [
                {
                    "name": a["name"],
                    "description": a.get("description", ""),
                    "cooldown_turns": a.get("cooldown_turns", 0),
                    "telegraph_turns": a.get("telegraph_turns", 0),
                    "phase": a.get("phase", 0),
                    "lane_scope": a.get("lane_scope", "same_lane"),
                }
                for a in self.abilities
            ],
            "phases": [
                {"threshold": p.get("threshold", 1.0), "name": p.get("name", ""), "description": p.get("description", "")}
                for p in self.phases
            ],
            "passive": self.passive or None,
            "rewards": self.rewards,
            "max_difficulty": self.max_difficulty,
            "difficulty_tiers": [Difficulty(t).to_dict() for t in range(1, self.max_difficulty + 1)],
            "difficulty_threats": [],
        }
