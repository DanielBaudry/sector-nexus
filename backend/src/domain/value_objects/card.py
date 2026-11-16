from dataclasses import dataclass
from typing import Dict, Any, Optional
from src.domain.value_objects.enums import TargetType


@dataclass
class CombatCard:
    id: str
    name: str
    description: str
    energy_cost: int
    target_type: TargetType
    power_multiplier: float  # multiplier of Champion ATK
    heal_multiplier: float = 0.0  # multiplier of Champion ATK or Max HP
    shield_grant: int = 0
    cooldown_turns: int = 0
    icon_name: str = "Zap"
    flavor_quote: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "energy_cost": self.energy_cost,
            "target_type": self.target_type.value if hasattr(self.target_type, "value") else str(self.target_type),
            "power_multiplier": self.power_multiplier,
            "heal_multiplier": self.heal_multiplier,
            "shield_grant": self.shield_grant,
            "cooldown_turns": self.cooldown_turns,
            "icon_name": self.icon_name,
            "flavor_quote": self.flavor_quote,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CombatCard":
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            energy_cost=data.get("energy_cost", 1),
            target_type=TargetType(data.get("target_type", TargetType.SINGLE_ENEMY)),
            power_multiplier=float(data.get("power_multiplier", 1.0)),
            heal_multiplier=float(data.get("heal_multiplier", 0.0)),
            shield_grant=int(data.get("shield_grant", 0)),
            cooldown_turns=int(data.get("cooldown_turns", 0)),
            icon_name=data.get("icon_name", "Zap"),
            flavor_quote=data.get("flavor_quote"),
        )
