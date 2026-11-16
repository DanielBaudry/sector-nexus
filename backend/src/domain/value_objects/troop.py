from dataclasses import dataclass
from typing import Dict, Any


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
        }
