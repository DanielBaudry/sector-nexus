from enum import Enum


class Faction(str, Enum):
    TERRAN = "Terran Vanguard"
    ZERG = "Bio-Swarm"
    PROTOSS = "Astral Templars"


class Rarity(str, Enum):
    COMMON = "Common"
    RARE = "Rare"
    EPIC = "Epic"
    LEGENDARY = "Legendary"


class Role(str, Enum):
    ASSAULT = "Assault"
    VANGUARD = "Vanguard"
    PSIONIC = "Psionic Specialist"
    SUPPORT = "Support"


class ArtifactSlot(str, Enum):
    WEAPON = "Weapon"
    ARMOR = "Armor"
    HELMET = "Helmet"
    BOOTS = "Boots"
    IMPLANT = "Neural Implant"
    CORE = "Power Core"


class ArtifactSetType(str, Enum):
    SPEED = "Hyper-Thrusters"       # 2-piece: +12% Speed
    LIFESTEAL = "Bio-Leech"         # 4-piece: Heal 20% of dmg dealt
    SHIELD = "Psionic Aegis"        # 2-piece: +20% Shields at battle start
    OFFENSE = "Gauss Overcharge"    # 2-piece: +15% Attack
    CRIT = "Precision Matrix"       # 2-piece: +15% Crit Rate


class TargetType(str, Enum):
    SINGLE_ENEMY = "single_enemy"
    ALL_ENEMIES = "all_enemies"
    SELF = "self"
    ALL_ALLIES = "all_allies"
    LOWEST_HP_ALLY = "lowest_hp_ally"


class GambitCondition(str, Enum):
    ALWAYS = "always"
    ALLY_HP_UNDER_50 = "ally_hp_under_50"
    SELF_SHIELD_DEPLETED = "self_shield_depleted"
    ENEMY_IS_ELITE = "enemy_is_elite"
    ENEMY_COUNT_OVER_1 = "enemy_count_over_1"
    ENEMY_LOW_HP = "enemy_low_hp"
