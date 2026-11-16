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
        preferred_set: str = None
    ) -> Artifact:
        slot = random.choice(list(ArtifactSlot))
        rarities = list(Rarity)
        min_idx = rarities.index(min_rarity)
        rarity = random.choice(rarities[min_idx:])

        set_type = ArtifactSetType(preferred_set) if preferred_set else random.choice(list(ArtifactSetType))

        # Main stat depends on slot
        if slot == ArtifactSlot.WEAPON:
            main_stat = "attack"
            base_val = random.randint(18, 35)
        elif slot in (ArtifactSlot.ARMOR, ArtifactSlot.HELMET):
            main_stat = random.choice(["defense", "hp"])
            base_val = random.randint(15, 30) if main_stat == "defense" else random.randint(50, 120)
        elif slot == ArtifactSlot.BOOTS:
            main_stat = "speed"
            base_val = random.randint(6, 16)
        elif slot == ArtifactSlot.CORE:
            main_stat = "shields"
            base_val = random.randint(40, 100)
        else:  # IMPLANT
            main_stat = random.choice(["attack", "defense", "hp"])
            base_val = random.randint(12, 28)

        # Rarity multiplier
        mult = {Rarity.COMMON: 1.0, Rarity.RARE: 1.3, Rarity.EPIC: 1.7, Rarity.LEGENDARY: 2.2}[rarity]
        final_main_val = int(base_val * mult)

        # Secondary substats
        possible_subs = ["crit_rate", "crit_damage", "speed", "attack", "defense"]
        num_subs = {Rarity.COMMON: 0, Rarity.RARE: 1, Rarity.EPIC: 2, Rarity.LEGENDARY: 3}[rarity]
        selected_subs = []
        for _ in range(num_subs):
            sub_name = random.choice(possible_subs)
            val = round(random.uniform(0.03, 0.08), 2) if "crit" in sub_name else random.randint(3, 10)
            selected_subs.append({"stat": sub_name, "value": val})

        names_by_slot = {
            ArtifactSlot.WEAPON: "C-14 Gauss Rifle",
            ArtifactSlot.ARMOR: "Neosteel Carapace",
            ArtifactSlot.HELMET: "Tactical HUD Visor",
            ArtifactSlot.BOOTS: "Afterburner Greaves",
            ArtifactSlot.IMPLANT: "Adrenal Stim Implant",
            ArtifactSlot.CORE: "Khaydarin Power Core",
        }

        return Artifact(
            id=f"art_{uuid.uuid4().hex[:8]}",
            template_id=f"tmpl_{slot.name.lower()}",
            name=f"{rarity.value} {names_by_slot.get(slot, 'Tech Module')}",
            slot=slot,
            rarity=rarity,
            set_type=set_type,
            level=1,
            main_stat_name=main_stat,
            main_stat_value=final_main_val,
            sub_stats=selected_subs,
            equipped_to=None,
        )
