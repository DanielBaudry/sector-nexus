from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from src.domain.value_objects.enums import Faction, Rarity, Role, ArtifactSetType, ArtifactSlot
from src.domain.value_objects.stats import Stats
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.gambit import GambitRule
from src.domain.entities.artifact import Artifact


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

    def get_effective_stats(self, artifacts_by_id: Dict[str, Artifact]) -> Stats:
        # Start with base stats
        hp = self.base_stats.hp
        max_hp = self.base_stats.max_hp
        shields = self.base_stats.shields
        max_shields = self.base_stats.max_shields
        attack = self.base_stats.attack
        defense = self.base_stats.defense
        speed = self.base_stats.speed
        crit_rate = self.base_stats.crit_rate
        crit_damage = self.base_stats.crit_damage

        # Level scaling
        lvl_mult = 1.0 + (self.level - 1) * 0.08
        max_hp = int(max_hp * lvl_mult)
        hp = max_hp
        attack = int(attack * lvl_mult)
        defense = int(defense * lvl_mult)
        if max_shields > 0:
            max_shields = int(max_shields * lvl_mult)
            shields = max_shields

        # Tally equipped artifacts and set counts
        set_counts: Dict[ArtifactSetType, int] = {}
        for slot, art_id in self.equipped_artifact_ids.items():
            if art_id in artifacts_by_id:
                art = artifacts_by_id[art_id]
                # Apply main stat
                if art.main_stat_name == "hp":
                    max_hp += art.main_stat_value
                    hp += art.main_stat_value
                elif art.main_stat_name == "shields":
                    max_shields += art.main_stat_value
                    shields += art.main_stat_value
                elif art.main_stat_name == "attack":
                    attack += art.main_stat_value
                elif art.main_stat_name == "defense":
                    defense += art.main_stat_value
                elif art.main_stat_name == "speed":
                    speed += art.main_stat_value

                # Apply sub stats
                for sub in art.sub_stats:
                    sub_name = sub.get("stat")
                    sub_val = sub.get("value", 0)
                    if sub_name == "crit_rate":
                        crit_rate += float(sub_val)
                    elif sub_name == "crit_damage":
                        crit_damage += float(sub_val)
                    elif sub_name == "attack":
                        attack += int(sub_val)
                    elif sub_name == "speed":
                        speed += int(sub_val)
                    elif sub_name == "defense":
                        defense += int(sub_val)

                # Set count
                set_counts[art.set_type] = set_counts.get(art.set_type, 0) + 1

        # Apply Set Bonuses
        if set_counts.get(ArtifactSetType.OFFENSE, 0) >= 2:
            attack = int(attack * 1.15)
        if set_counts.get(ArtifactSetType.SPEED, 0) >= 2:
            speed = int(speed * 1.12)
        if set_counts.get(ArtifactSetType.SHIELD, 0) >= 2:
            extra_shield = int(max_hp * 0.20)
            max_shields += extra_shield
            shields += extra_shield
        if set_counts.get(ArtifactSetType.CRIT, 0) >= 2:
            crit_rate += 0.15

        return Stats(
            hp=hp,
            max_hp=max_hp,
            shields=shields,
            max_shields=max_shields,
            attack=attack,
            defense=defense,
            speed=speed,
            crit_rate=min(1.0, round(crit_rate, 2)),
            crit_damage=round(crit_damage, 2),
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
        )
