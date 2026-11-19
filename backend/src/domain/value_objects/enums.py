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


# ── Lane Battle / Expedition Run ─────────────────────────────────────────────

class LaneScope(str, Enum):
    """Which lanes a hero ability reaches. Troops always stay in their own lane."""
    SAME_LANE = "same_lane"
    ADJACENT_LANES = "adjacent_lanes"   # own lane + neighbours
    ANY_LANE = "any_lane"               # player picks one target lane
    ALL_LANES = "all_lanes"


class Side(str, Enum):
    ALLY = "ALLY"
    ENEMY = "ENEMY"


class UnitKind(str, Enum):
    HERO = "HERO"
    TROOP = "TROOP"


class NodeType(str, Enum):
    START = "START"
    COMBAT = "COMBAT"
    ELITE = "ELITE"
    REST = "REST"
    CACHE = "CACHE"
    ARCHIVE = "ARCHIVE"  # derelict warp archive: hero blueprints & print materials
    BOSS = "BOSS"


class ObjectiveType(str, Enum):
    CLEAR_LANES = "CLEAR_LANES"         # primary: wipe enemies in N lanes
    DEFEND_LANE = "DEFEND_LANE"         # constraint: keep >=1 ally unit alive in lane
    SURVIVE_TURNS = "SURVIVE_TURNS"     # primary: hold out until turn N
    ELIMINATE_BOSS = "ELIMINATE_BOSS"   # primary: kill the boss unit


class RunStatus(str, Enum):
    MAP = "MAP"                 # choosing next node
    DEPLOYMENT = "DEPLOYMENT"   # placing heroes in lanes before a battle
    BATTLE = "BATTLE"
    VICTORY = "VICTORY"
    DEFEAT = "DEFEAT"
    ABANDONED = "ABANDONED"


class BattleStatus(str, Enum):
    DEPLOYMENT = "DEPLOYMENT"
    IN_PROGRESS = "IN_PROGRESS"
    WON = "WON"
    LOST = "LOST"
