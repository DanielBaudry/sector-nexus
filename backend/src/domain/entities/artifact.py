import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.domain.value_objects import artifact_stats as AS
from src.domain.value_objects.enums import ArtifactSetType, ArtifactSlot, Rarity


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
    main_stat_value: float
    sub_stats: List[Dict[str, Any]] = field(default_factory=list)
    equipped_to: Optional[str] = None
    rank: int = 5  # 1-6 stars

    # ── Progression ─────────────────────────────────────────────────────────
    @property
    def is_maxed(self) -> bool:
        return self.level >= AS.MAX_LEVEL

    def upgrade_cost(self) -> int:
        return AS.upgrade_cost(self.rank, self.level)

    def upgrade_chance(self) -> float:
        return AS.upgrade_chance(self.level)

    def try_upgrade(self, rng: Optional[random.Random] = None) -> Dict[str, Any]:
        """One upgrade attempt. Caller pays the cost either way (RSL rule)."""
        if self.is_maxed:
            raise ValueError("Artifact is already at +16.")
        rng = rng or random.Random()
        if rng.random() > self.upgrade_chance():
            return {"success": False, "level": self.level}

        self.level += 1
        self.main_stat_value = AS.main_value(self.main_stat_name, self.rank, self.level)
        result: Dict[str, Any] = {"success": True, "level": self.level}
        if self.level in AS.MILESTONES:
            kind, sub = AS.milestone_roll(self.main_stat_name, self.sub_stats, self.rank, rng)
            result["substat"] = {"kind": kind, **sub}
        return result

    @classmethod
    def generate(
        cls, artifact_id: str, rarity: Rarity, rank: int, set_type: ArtifactSetType,
        rng: Optional[random.Random] = None, slot: Optional[ArtifactSlot] = None,
    ) -> "Artifact":
        rng = rng or random.Random()
        slot = slot or rng.choice(list(ArtifactSlot))
        main = AS.pick_main_stat(slot, rng)
        return cls(
            id=artifact_id,
            template_id=f"tmpl_{slot.name.lower()}",
            name=f"{SET_PREFIX.get(set_type, '')} {SLOT_NAMES.get(slot, 'Module')}".strip(),
            slot=slot,
            rarity=rarity,
            set_type=set_type,
            level=0,
            main_stat_name=main,
            main_stat_value=AS.main_value(main, rank, 0),
            sub_stats=AS.roll_substats(main, rarity, rank, rng),
            rank=rank,
        )

    # ── Serialisation ───────────────────────────────────────────────────────
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
            "rank": self.rank,
        }

    def to_view(self) -> Dict[str, Any]:
        """API view: persisted fields + upgrade economics."""
        return {
            **self.to_dict(),
            "max_level": AS.MAX_LEVEL,
            "upgrade_cost": None if self.is_maxed else self.upgrade_cost(),
            "upgrade_chance": None if self.is_maxed else self.upgrade_chance(),
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
            level=int(data.get("level", 0)),
            main_stat_name=data.get("main_stat_name", "attack"),
            main_stat_value=data.get("main_stat_value", 10),
            sub_stats=data.get("sub_stats", []) or [],
            equipped_to=data.get("equipped_to"),
            rank=int(data.get("rank") or 5),
        )


SLOT_NAMES = {
    ArtifactSlot.WEAPON: "Gauss Rifle",
    ArtifactSlot.ARMOR: "Neosteel Carapace",
    ArtifactSlot.HELMET: "Tactical Visor",
    ArtifactSlot.BOOTS: "Afterburner Greaves",
    ArtifactSlot.IMPLANT: "Neural Implant",
    ArtifactSlot.CORE: "Power Core",
}

SET_PREFIX = {
    ArtifactSetType.SPEED: "Hyper",
    ArtifactSetType.LIFESTEAL: "Leeching",
    ArtifactSetType.SHIELD: "Aegis",
    ArtifactSetType.OFFENSE: "Gauss",
    ArtifactSetType.CRIT: "Precision",
}
