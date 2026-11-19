from dataclasses import dataclass, field
from typing import Any, Dict, Tuple

UPGRADE_KINDS = ("structure", "research")
BONUS_STATS = ("attack", "hp", "defense")


@dataclass(frozen=True)
class Upgrade:
    """
    A barracks tech: a structure (unlocks troop production) or a research
    (permanent stat bonus for every troop pack of its faction).
    """
    id: str
    name: str
    faction: str
    kind: str = "structure"
    description: str = ""
    cost_credits: int = 0
    cost_crystals: int = 0
    requires: Tuple[str, ...] = ()
    bonus: Dict[str, float] = field(default_factory=dict)  # stat -> pct (0.10 = +10%)
    order: int = 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "faction": self.faction,
            "kind": self.kind,
            "description": self.description,
            "cost": {"credits": self.cost_credits, "crystals": self.cost_crystals},
            "requires": list(self.requires),
            "bonus": dict(self.bonus),
            "order": self.order,
        }
