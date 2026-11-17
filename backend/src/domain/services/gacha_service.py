import random
import uuid
from typing import List, Dict, Any, Tuple
from src.domain.value_objects.enums import Rarity, Faction, ArtifactSlot, ArtifactSetType
from src.domain.entities.artifact import Artifact
from src.domain.entities.champion import Champion


class GachaService:
    # Summon rates: Legendary: 3%, Epic: 15%, Rare: 42%, Common: 40%
    RARITY_WEIGHTS = [
        (Rarity.LEGENDARY, 0.03),
        (Rarity.EPIC, 0.15),
        (Rarity.RARE, 0.42),
        (Rarity.COMMON, 0.40),
    ]

    @staticmethod
    def roll_rarity() -> Rarity:
        roll = random.random()
        cumulative = 0.0
        for rarity, weight in GachaService.RARITY_WEIGHTS:
            cumulative += weight
            if roll <= cumulative:
                return rarity
        return Rarity.COMMON

    @staticmethod
    def summon_champion(
        champion_pool: List[Champion],
        banner_faction: str = "ALL"
    ) -> Champion:
        target_rarity = GachaService.roll_rarity()

        # Filter by rarity
        matching = [c for c in champion_pool if c.rarity == target_rarity]

        # Filter by banner faction if specified and available
        if banner_faction != "ALL":
            faction_matching = [c for c in matching if c.faction.value == banner_faction or c.faction.name == banner_faction]
            if faction_matching:
                matching = faction_matching

        if not matching:
            # Fallback to any champion in pool
            matching = champion_pool

        template = random.choice(matching)
        # Create a new clone instance with unique ID
        new_champion = Champion(
            id=f"champ_{uuid.uuid4().hex[:8]}",
            template_id=template.template_id,
            name=template.name,
            title=template.title,
            faction=template.faction,
            role=template.role,
            rarity=template.rarity,
            level=1,
            experience=0,
            base_stats=template.base_stats,
            cards=template.cards,
            gambits=template.gambits,
            equipped_artifact_ids={},
            avatar_color=template.avatar_color,
            avatar_icon=template.avatar_icon,
        )
        return new_champion

    @staticmethod
    def generate_random_artifact(
        min_rarity: Rarity = Rarity.COMMON,
        preferred_set: str = None,
        rank: int = None,
    ) -> Artifact:
        rarities = list(Rarity)
        rarity = random.choice(rarities[rarities.index(min_rarity):])
        set_type = ArtifactSetType(preferred_set) if preferred_set else random.choice(list(ArtifactSetType))
        return Artifact.generate(
            artifact_id=f"art_{uuid.uuid4().hex[:8]}",
            rarity=rarity,
            rank=rank or random.randint(3, 5),
            set_type=set_type,
        )
