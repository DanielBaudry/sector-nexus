from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from src.domain.value_objects.enums import ArtifactSlot, ArtifactSetType, Rarity


@dataclass
class Artifact:
    id: str
    template_id: str
    name: str
    slot: ArtifactSlot
    rarity: Rarity
    set_type: ArtifactSetType
    level: int
    main_stat_name: str
    main_stat_value: int
    sub_stats: List[Dict[str, Any]] = field(default_factory=list)
    equipped_to: Optional[str] = None

    def upgrade(self) -> None:
        if self.level < 16:
            self.level += 1
            # Scaling main stat
            self.main_stat_value = int(self.main_stat_value * 1.15) + 3

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "template_id": self.template_id,
            "name": self.name,
            "slot": self.slot.value if hasattr(self.slot, "value") else str(self.slot),
            "rarity": self.rarity.value if hasattr(self.rarity, "value") else str(self.rarity),
            "set_type": self.set_type.value if hasattr(self.set_type, "value") else str(self.set_type),
            "level": self.level,
            "main_stat_name": self.main_stat_name,
            "main_stat_value": self.main_stat_value,
            "sub_stats": self.sub_stats,
            "equipped_to": self.equipped_to,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Artifact":
        return cls(
            id=data["id"],
            template_id=data.get("template_id", data["id"]),
            name=data["name"],
            slot=ArtifactSlot(data["slot"]),
            rarity=Rarity(data.get("rarity", Rarity.COMMON)),
            set_type=ArtifactSetType(data.get("set_type", ArtifactSetType.OFFENSE)),
            level=int(data.get("level", 1)),
            main_stat_name=data.get("main_stat_name", "attack"),
            main_stat_value=int(data.get("main_stat_value", 10)),
            sub_stats=data.get("sub_stats", []),
            equipped_to=data.get("equipped_to"),
        )
