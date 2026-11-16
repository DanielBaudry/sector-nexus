from dataclasses import dataclass, field
from typing import List, Dict, Any
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
        }
