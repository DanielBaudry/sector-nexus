from dataclasses import dataclass, field
from typing import List, Dict, Any
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.enums import ArtifactSetType


@dataclass
class Biome:
    id: str
    name: str
    description: str
    hazard_name: str
    hazard_description: str
    recommended_power: int
    allowed_artifact_sets: List[ArtifactSetType]
    color: str
    bg_gradient: str
    icon_name: str
    enemy_pool: List[Dict[str, Any]] = field(default_factory=list)
    # Highest selectable difficulty tier (1 = no difficulty selection).
    max_difficulty: int = 1
    # Extra enemies unlocked by difficulty: dicts with "min_tier", "role" (troop/elite/boss) and optional "cards".
    difficulty_enemies: List[Dict[str, Any]] = field(default_factory=list)

    def tier_enemies(self, tier: int, role: str) -> List[Dict[str, Any]]:
        return [e for e in self.difficulty_enemies if e.get("role") == role and e.get("min_tier", 1) <= tier]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "hazard_name": self.hazard_name,
            "hazard_description": self.hazard_description,
            "recommended_power": self.recommended_power,
            "allowed_artifact_sets": [s.value if hasattr(s, "value") else str(s) for s in self.allowed_artifact_sets],
            "color": self.color,
            "bg_gradient": self.bg_gradient,
            "icon_name": self.icon_name,
            "enemy_pool": self.enemy_pool,
            "max_difficulty": self.max_difficulty,
            "difficulty_tiers": [Difficulty(t).to_dict() for t in range(1, self.max_difficulty + 1)],
            "difficulty_threats": [
                {
                    "name": e["name"],
                    "min_tier": e.get("min_tier", 1),
                    "role": e.get("role"),
                    "abilities": [c["name"] for c in e.get("cards", [])],
                }
                for e in self.difficulty_enemies
            ],
        }
