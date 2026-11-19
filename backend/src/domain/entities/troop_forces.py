from dataclasses import dataclass, field
from typing import Any, Dict, Set


@dataclass
class TroopForces:
    """The player's standing army: troop packs in the garrison and completed barracks techs."""
    stock: Dict[str, int] = field(default_factory=dict)  # troop template id -> packs available
    researched: Set[str] = field(default_factory=set)     # upgrade ids

    def available(self, template_id: str) -> int:
        return self.stock.get(template_id, 0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stock": {k: v for k, v in self.stock.items() if v > 0},
            "researched": sorted(self.researched),
        }
