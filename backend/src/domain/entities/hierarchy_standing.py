from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict


class ChampionStatus(str, Enum):
    LOCKED = "LOCKED"          # shielded by subordinates still standing
    HUNTED = "HUNTED"          # can be targeted; Influence is being gathered
    VULNERABLE = "VULNERABLE"  # enough Influence: the boss fight is open
    DEFEATED = "DEFEATED"      # claimed by the player


@dataclass
class HierarchyStanding:
    """The player's persistent progress against one champion of a planet's hierarchy."""
    boss_id: str
    planet_id: str
    influence: int = 0
    defeated: bool = False
    losses: int = 0            # boss fights lost against this champion (drives its adaptations)
    targeted: bool = False     # expeditions on the planet feed Influence to the targeted champion

    def to_dict(self) -> Dict[str, Any]:
        return {
            "boss_id": self.boss_id,
            "planet_id": self.planet_id,
            "influence": self.influence,
            "defeated": self.defeated,
            "losses": self.losses,
            "targeted": self.targeted,
        }
