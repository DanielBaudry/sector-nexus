from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from src.domain.value_objects.enums import Faction, Rarity, Role, ArtifactSetType, ArtifactSlot
from src.domain.value_objects.stats import Stats
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.gambit import GambitRule
from src.domain.entities.artifact import Artifact

MAX_RANK = 6
LEVELS_PER_RANK = 10          # max level = rank * 10 (rank 6 -> 60)
LEVEL_STAT_GROWTH = 0.06      # +6% base stats per level
RANK_STAT_GROWTH = 0.08       # +8% base stats per rank
STARTING_RANK = {Rarity.COMMON: 1, Rarity.RARE: 2, Rarity.EPIC: 3, Rarity.LEGENDARY: 4}


def xp_for_level(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    return int(15 * level ** 1.5) + 20


def rank_up_cost(rank: int) -> int:
    """Credits to rank up from `rank`."""
    return 2000 * rank


@dataclass
class Champion:
    id: str
    template_id: str
    name: str
    title: str
    faction: Faction
    role: Role
    rarity: Rarity
    level: int
    experience: int
    base_stats: Stats
    cards: List[CombatCard]
    gambits: List[GambitRule]
    equipped_artifact_ids: Dict[str, str] = field(default_factory=dict)  # slot.value -> artifact_id
    avatar_color: str = "#3b82f6"
    avatar_icon: str = "Shield"
    rank: int = 0  # 1-6 stars; 0 = derive from rarity

    def __post_init__(self) -> None:
        if not self.rank:
            self.rank = STARTING_RANK.get(self.rarity, 1)

    # ── Progression (RSL-style, simplified) ─────────────────────────────────
    @property
    def max_level(self) -> int:
        return self.rank * LEVELS_PER_RANK

    @property
    def is_level_maxed(self) -> bool:
        return self.level >= self.max_level

    def xp_to_next(self) -> int:
        return xp_for_level(self.level)

    def gain_xp(self, amount: int) -> int:
        """Apply XP up to the rank's level cap. Returns XP actually consumed."""
        used = 0
        while amount > 0 and not self.is_level_maxed:
            need = self.xp_to_next() - self.experience
            step = min(need, amount)
            self.experience += step
            amount -= step
            used += step
            if self.experience >= self.xp_to_next():
                self.experience = 0
                self.level += 1
        if self.is_level_maxed:
            self.experience = 0
        return used

    def xp_to_cap(self) -> int:
        """XP still needed to reach the current rank's max level."""
        if self.is_level_maxed:
            return 0
        return sum(xp_for_level(l) for l in range(self.level, self.max_level)) - self.experience

    def rank_up(self) -> None:
        if self.rank >= MAX_RANK:
            raise ValueError(f"{self.name} is already at max rank.")
        if not self.is_level_maxed:
            raise ValueError(f"{self.name} must reach level {self.max_level} first.")
        self.rank += 1
        self.level = 1
        self.experience = 0

    def progression_view(self) -> Dict[str, Any]:
        return {
            "max_level": self.max_level,
            "max_rank": MAX_RANK,
            "xp_to_next": 0 if self.is_level_maxed else self.xp_to_next(),
            "xp_to_cap": self.xp_to_cap(),
            "can_rank_up": self.is_level_maxed and self.rank < MAX_RANK,
            "rank_up_fodder": self.rank,          # champions of this rank or higher consumed
            "rank_up_cost": rank_up_cost(self.rank),
        }

    def get_effective_stats(self, artifacts_by_id: Dict[str, Artifact]) -> Stats:
        # Level & rank scaling on base stats
        mult = (1.0 + (self.level - 1) * LEVEL_STAT_GROWTH) * (1.0 + (self.rank - 1) * RANK_STAT_GROWTH)
        base_hp = int(self.base_stats.max_hp * mult)
        base_atk = int(self.base_stats.attack * mult)
        base_def = int(self.base_stats.defense * mult)
        base_shields = int(self.base_stats.max_shields * mult)
        speed = self.base_stats.speed
        crit_rate = self.base_stats.crit_rate
        crit_damage = self.base_stats.crit_damage

        # Gear: flat and % bonuses from main stats and substats
        flat: Dict[str, float] = {}
        pct: Dict[str, float] = {}
        set_counts: Dict[ArtifactSetType, int] = {}

        def add(stat: str, value: float) -> None:
            if stat.endswith("_pct"):
                pct[stat[:-4]] = pct.get(stat[:-4], 0.0) + float(value)
            else:
                flat[stat] = flat.get(stat, 0.0) + float(value)

        for art_id in self.equipped_artifact_ids.values():
            art = artifacts_by_id.get(art_id)
            if not art:
                continue
            add(art.main_stat_name, art.main_stat_value)
            for sub in art.sub_stats:
                if sub.get("stat"):
                    add(sub["stat"], sub.get("value", 0))
            set_counts[art.set_type] = set_counts.get(art.set_type, 0) + 1

        max_hp = int(base_hp * (1 + pct.get("hp", 0)) + flat.get("hp", 0))
        attack = int(base_atk * (1 + pct.get("attack", 0)) + flat.get("attack", 0))
        defense = int(base_def * (1 + pct.get("defense", 0)) + flat.get("defense", 0))
        max_shields = int(base_shields * (1 + pct.get("shields", 0)) + flat.get("shields", 0))
        speed = int(speed + flat.get("speed", 0))
        crit_rate += flat.get("crit_rate", 0)
        crit_damage += flat.get("crit_damage", 0)
        accuracy = int(self.base_stats.accuracy + flat.get("accuracy", 0))
        resistance = int(self.base_stats.resistance + flat.get("resistance", 0))

        # Set bonuses
        if set_counts.get(ArtifactSetType.OFFENSE, 0) >= 2:
            attack = int(attack * 1.15)
        if set_counts.get(ArtifactSetType.SPEED, 0) >= 2:
            speed = int(speed * 1.12)
        if set_counts.get(ArtifactSetType.SHIELD, 0) >= 2:
            max_shields += int(max_hp * 0.20)
        if set_counts.get(ArtifactSetType.CRIT, 0) >= 2:
            crit_rate += 0.15

        return Stats(
            hp=max_hp,
            max_hp=max_hp,
            shields=max_shields,
            max_shields=max_shields,
            attack=attack,
            defense=defense,
            speed=speed,
            crit_rate=min(1.0, round(crit_rate, 3)),
            crit_damage=round(crit_damage, 3),
            accuracy=accuracy,
            resistance=resistance,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "template_id": self.template_id,
            "name": self.name,
            "title": self.title,
            "faction": self.faction.value if hasattr(self.faction, "value") else str(self.faction),
            "role": self.role.value if hasattr(self.role, "value") else str(self.role),
            "rarity": self.rarity.value if hasattr(self.rarity, "value") else str(self.rarity),
            "level": self.level,
            "experience": self.experience,
            "base_stats": self.base_stats.to_dict(),
            "cards": [card.to_dict() for card in self.cards],
            "gambits": [gambit.to_dict() for gambit in self.gambits],
            "equipped_artifact_ids": self.equipped_artifact_ids,
            "avatar_color": self.avatar_color,
            "avatar_icon": self.avatar_icon,
            "rank": self.rank,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Champion":
        return cls(
            id=data["id"],
            template_id=data.get("template_id", data["id"]),
            name=data["name"],
            title=data.get("title", ""),
            faction=Faction(data["faction"]),
            role=Role(data["role"]),
            rarity=Rarity(data.get("rarity", Rarity.COMMON)),
            level=int(data.get("level", 1)),
            experience=int(data.get("experience", 0)),
            base_stats=Stats.from_dict(data["base_stats"]),
            cards=[CombatCard.from_dict(c) for c in data.get("cards", [])],
            gambits=[GambitRule.from_dict(g) for g in data.get("gambits", [])],
            equipped_artifact_ids=data.get("equipped_artifact_ids", {}),
            avatar_color=data.get("avatar_color", "#3b82f6"),
            avatar_icon=data.get("avatar_icon", "Shield"),
            rank=int(data.get("rank") or 0),
        )
