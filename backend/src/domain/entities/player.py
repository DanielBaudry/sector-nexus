from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class PlayerProfile:
    id: str
    username: str
    crystals: int
    credits: int
    warp_shards: int
    level: int = 1
    experience: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "crystals": self.crystals,
            "credits": self.credits,
            "warp_shards": self.warp_shards,
            "level": self.level,
            "experience": self.experience,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlayerProfile":
        return cls(
            id=data["id"],
            username=data.get("username", "Commander"),
            crystals=int(data.get("crystals", 1200)),
            credits=int(data.get("credits", 25000)),
            warp_shards=int(data.get("warp_shards", 10)),
            level=int(data.get("level", 1)),
            experience=int(data.get("experience", 0)),
        )
