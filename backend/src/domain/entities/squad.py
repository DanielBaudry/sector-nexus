from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class Squad:
    id: str
    name: str
    champion_ids: List[str] = field(default_factory=list)  # max 4 champions

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "champion_ids": self.champion_ids,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Squad":
        return cls(
            id=data["id"],
            name=data.get("name", "Vanguard Strike Team"),
            champion_ids=data.get("champion_ids", []),
        )
