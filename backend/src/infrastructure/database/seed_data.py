"""
Seed facade.

Game content (heroes, troops, planets & enemies, bosses & hierarchies) lives in
`backend/content/*.json` — see content/README.md. These helpers keep the historic
`get_seed_*` names and read from the content library (hot-reloaded on file change).
Only the starter artifact pack is still defined in code.
"""
from typing import List

from src.domain.entities.artifact import Artifact
from src.domain.entities.biome import Biome
from src.domain.entities.boss_encounter import BossEncounter
from src.domain.entities.champion import Champion
from src.domain.value_objects.enums import ArtifactSetType, ArtifactSlot, Rarity
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.content.library import get_library


def get_seed_champion_templates() -> List[Champion]:
    return get_library().champion_templates()


def get_seed_troop_templates() -> List[TroopTemplate]:
    return get_library().troop_templates()


def get_seed_biomes() -> List[Biome]:
    return get_library().biomes()


def get_seed_boss_encounters() -> List[BossEncounter]:
    return get_library().boss_encounters()


def get_seed_starting_artifacts() -> List[Artifact]:
    return [
        Artifact(
            id="art_seed_weapon_1",
            template_id="tmpl_weapon",
            name="Rare C-14 Gauss Penetrator",
            slot=ArtifactSlot.WEAPON,
            rarity=Rarity.RARE,
            set_type=ArtifactSetType.OFFENSE,
            level=3,
            main_stat_name="attack",
            main_stat_value=32,
            sub_stats=[{"stat": "crit_rate", "value": 0.05}],
            equipped_to="user_champ_raynor",
        ),
        Artifact(
            id="art_seed_armor_1",
            template_id="tmpl_armor",
            name="Epic Neosteel Heavy Plating",
            slot=ArtifactSlot.ARMOR,
            rarity=Rarity.EPIC,
            set_type=ArtifactSetType.SHIELD,
            level=4,
            main_stat_name="defense",
            main_stat_value=38,
            sub_stats=[{"stat": "hp", "value": 60}, {"stat": "defense", "value": 8}],
            equipped_to="user_champ_artanis",
        ),
        Artifact(
            id="art_seed_boots_1",
            template_id="tmpl_boots",
            name="Rare Hyperion Thrusters",
            slot=ArtifactSlot.BOOTS,
            rarity=Rarity.RARE,
            set_type=ArtifactSetType.SPEED,
            level=2,
            main_stat_name="speed",
            main_stat_value=14,
            sub_stats=[{"stat": "crit_damage", "value": 0.08}],
            equipped_to=None,
        ),
        Artifact(
            id="art_seed_core_1",
            template_id="tmpl_core",
            name="Legendary Khaydarin Reactor",
            slot=ArtifactSlot.CORE,
            rarity=Rarity.LEGENDARY,
            set_type=ArtifactSetType.CRIT,
            level=6,
            main_stat_name="shields",
            main_stat_value=160,
            sub_stats=[{"stat": "crit_rate", "value": 0.08}, {"stat": "speed", "value": 6}, {"stat": "attack", "value": 14}],
            equipped_to=None,
        ),
    ]


# ══════════════════════════════════════════════════════════════════════════════
# LANE BATTLE CATALOG (Active Expedition runs)
# ══════════════════════════════════════════════════════════════════════════════
from src.domain.value_objects.enums import LaneScope  # noqa: E402
