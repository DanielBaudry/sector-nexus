from dataclasses import dataclass, field
from typing import Dict, Any


@dataclass
class Stats:
    hp: int
    max_hp: int
    shields: int
    max_shields: int
    attack: int
    defense: int
    speed: int
    crit_rate: float  # e.g. 0.15 for 15%
    crit_damage: float  # e.g. 1.50 for 150%

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hp": self.hp,
            "max_hp": self.max_hp,
            "shields": self.shields,
            "max_shields": self.max_shields,
            "attack": self.attack,
            "defense": self.defense,
            "speed": self.speed,
            "crit_rate": round(self.crit_rate, 2),
            "crit_damage": round(self.crit_damage, 2),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Stats":
        return cls(
            hp=int(data.get("hp", 100)),
            max_hp=int(data.get("max_hp", 100)),
            shields=int(data.get("shields", 0)),
            max_shields=int(data.get("max_shields", 0)),
            attack=int(data.get("attack", 20)),
            defense=int(data.get("defense", 10)),
            speed=int(data.get("speed", 100)),
            crit_rate=float(data.get("crit_rate", 0.15)),
            crit_damage=float(data.get("crit_damage", 1.5)),
        )
