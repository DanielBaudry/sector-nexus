from dataclasses import dataclass
from typing import Any, Dict, Tuple


@dataclass(frozen=True)
class TroopTemplate:
    """A pack of soldiers. Pack HP = count * unit_hp; volley damage = alive soldiers * unit_attack."""
    id: str
    name: str
    faction: str
    count: int
    unit_hp: int
    unit_attack: int
    defense: int
    description: str = ""
    icon_name: str = "Users"
    mana_cost: int = 3  # mana spent to deploy the pack mid-battle
    # Barracks production: price of one pack and the techs (structures) it needs.
    cost_credits: int = 0
    cost_crystals: int = 0
    requires: Tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "faction": self.faction,
            "count": self.count,
            "unit_hp": self.unit_hp,
            "unit_attack": self.unit_attack,
            "defense": self.defense,
            "description": self.description,
            "icon_name": self.icon_name,
            "mana_cost": self.mana_cost,
            "cost": {"credits": self.cost_credits, "crystals": self.cost_crystals},
            "requires": list(self.requires),
        }
