"""
Buffs, debuffs and hero passives for the lane battle.

* A StatusEffect lives on a unit for N of *that unit's* turns (heroes: their actions,
  troop packs: their volleys). Effects applied during the holder's own action are
  "fresh" and skip that action's countdown, so "2 turns" always means 2 future turns.
* Same effect twice: no stacking — the duration is refreshed and the stronger value kept.
  Damage-over-time effects (BURN, POISON) are the exception and stack up to MAX_DOT_STACKS.
* Debuffs must beat Resistance with Accuracy: see `debuff_land_chance`.
* An EffectSpec on an ability describes what it applies (or cleanses / strips / steals) and to whom.
* A Passive is a permanent hero trait resolved by the battle engine on specific triggers.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


class EffectType(str, Enum):
    # Buffs
    ATK_UP = "ATK_UP"
    DEF_UP = "DEF_UP"
    SPD_UP = "SPD_UP"
    CRIT_UP = "CRIT_UP"
    IMMUNITY = "IMMUNITY"        # blocks new debuffs
    REGEN = "REGEN"              # heals value x max HP at turn start
    # Debuffs
    ATK_DOWN = "ATK_DOWN"
    DEF_DOWN = "DEF_DOWN"
    SPD_DOWN = "SPD_DOWN"
    BURN = "BURN"                # value x max HP damage at turn start (stacks)
    POISON = "POISON"            # value x max HP damage at turn start (stacks)
    STUN = "STUN"                # skips the next turn
    HEAL_BLOCK = "HEAL_BLOCK"    # cannot be healed
    MARKED = "MARKED"            # takes +value extra damage


class EffectOp(str, Enum):
    """Ability operations that act on existing effects instead of adding one."""
    CLEANSE = "CLEANSE"          # remove debuffs from allies
    STRIP = "STRIP"              # remove buffs from enemies
    STEAL = "STEAL"              # move buffs from enemies to the caster


BUFFS = {EffectType.ATK_UP, EffectType.DEF_UP, EffectType.SPD_UP, EffectType.CRIT_UP,
         EffectType.IMMUNITY, EffectType.REGEN}
DEBUFFS = {EffectType.ATK_DOWN, EffectType.DEF_DOWN, EffectType.SPD_DOWN, EffectType.BURN,
           EffectType.POISON, EffectType.STUN, EffectType.HEAL_BLOCK, EffectType.MARKED}
DOT_TYPES = {EffectType.BURN, EffectType.POISON}
MAX_DOT_STACKS = 5

# Stat percentage modifiers: effect -> (stat, sign)
STAT_MODIFIERS = {
    EffectType.ATK_UP: ("attack", 1), EffectType.ATK_DOWN: ("attack", -1),
    EffectType.DEF_UP: ("defense", 1), EffectType.DEF_DOWN: ("defense", -1),
    EffectType.SPD_UP: ("speed", 1), EffectType.SPD_DOWN: ("speed", -1),
    EffectType.CRIT_UP: ("crit_rate", 1),
}

EFFECT_LABELS = {
    EffectType.ATK_UP: "ATK UP", EffectType.DEF_UP: "DEF UP", EffectType.SPD_UP: "SPD UP",
    EffectType.CRIT_UP: "CRIT UP", EffectType.IMMUNITY: "IMMUNITY", EffectType.REGEN: "REGEN",
    EffectType.ATK_DOWN: "ATK DOWN", EffectType.DEF_DOWN: "DEF DOWN", EffectType.SPD_DOWN: "SPD DOWN",
    EffectType.BURN: "BURN", EffectType.POISON: "POISON", EffectType.STUN: "STUN",
    EffectType.HEAL_BLOCK: "HEAL BLOCK", EffectType.MARKED: "MARKED",
}


def is_buff(effect_type: EffectType) -> bool:
    return effect_type in BUFFS


def describe_effect(effect_type: EffectType, value: float) -> str:
    pct = f"{round(value * 100)}%"
    return {
        EffectType.ATK_UP: f"+{pct} attack",
        EffectType.DEF_UP: f"+{pct} defense",
        EffectType.SPD_UP: f"+{pct} speed",
        EffectType.CRIT_UP: f"+{pct} crit rate",
        EffectType.IMMUNITY: "Immune to new debuffs",
        EffectType.REGEN: f"Heals {pct} max HP each turn",
        EffectType.ATK_DOWN: f"-{pct} attack",
        EffectType.DEF_DOWN: f"-{pct} defense",
        EffectType.SPD_DOWN: f"-{pct} speed",
        EffectType.BURN: f"Takes {pct} max HP each turn",
        EffectType.POISON: f"Takes {pct} max HP each turn",
        EffectType.STUN: "Skips its next turn",
        EffectType.HEAL_BLOCK: "Cannot be healed",
        EffectType.MARKED: f"Takes +{pct} damage",
    }[effect_type]


def debuff_land_chance(base_chance: float, accuracy: float, resistance: float) -> float:
    """
    RSL-style resist check: every point of Resistance above the caster's Accuracy
    removes 0.4% from the debuff's chance (250 points = always resisted). Floor 5%.
    Accuracy above Resistance gives no bonus beyond the base chance.
    """
    gap = max(0.0, resistance - accuracy)
    return max(0.05, min(1.0, base_chance - gap * 0.004))


@dataclass
class StatusEffect:
    type: EffectType
    value: float
    turns: int
    source_id: Optional[str] = None
    fresh: bool = False   # applied during the holder's current turn: skips this turn's countdown

    @property
    def is_buff(self) -> bool:
        return is_buff(self.type)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "label": EFFECT_LABELS[self.type],
            "value": round(self.value, 3),
            "turns": self.turns,
            "is_buff": self.is_buff,
            "description": describe_effect(self.type, self.value),
            "source_id": self.source_id,
        }


# Ability effect targets
EFFECT_TARGETS = ("self", "ally", "allies", "hit", "enemies")


@dataclass
class EffectSpec:
    """
    What an ability does with status effects.
    target: self | ally (the healed / chosen ally) | allies (all allies in reach)
            | hit (every enemy damaged by the ability) | enemies (all enemies in reach)
    For ops (CLEANSE / STRIP / STEAL) `count` is the number of effects affected.
    `chance` is the base land chance for debuffs (Accuracy vs Resistance applies).
    """
    type: str                      # EffectType or EffectOp value
    target: str = "hit"
    value: float = 0.0
    turns: int = 2
    chance: float = 1.0
    count: int = 1

    @property
    def effect_type(self) -> Optional[EffectType]:
        return EffectType(self.type) if self.type in EffectType.__members__ else None

    @property
    def op(self) -> Optional[EffectOp]:
        return EffectOp(self.type) if self.type in EffectOp.__members__ else None

    def describe(self) -> str:
        who = {"self": "self", "ally": "the ally", "allies": "allies in reach",
               "hit": "targets hit", "enemies": "enemies in reach"}.get(self.target, self.target)
        if self.op == EffectOp.CLEANSE:
            return f"Removes {self.count} debuff{'s' if self.count > 1 else ''} from {who}"
        if self.op == EffectOp.STRIP:
            return f"Removes {self.count} buff{'s' if self.count > 1 else ''} from {who}"
        if self.op == EffectOp.STEAL:
            return f"Steals {self.count} buff{'s' if self.count > 1 else ''} from {who}"
        et = self.effect_type
        chance = f"{round(self.chance * 100)}% chance: " if self.chance < 1 and et in DEBUFFS else ""
        return f"{chance}{EFFECT_LABELS[et]} ({describe_effect(et, self.value)}) on {who} for {self.turns} turn{'s' if self.turns > 1 else ''}"

    def to_dict(self) -> Dict[str, Any]:
        et = self.effect_type
        return {
            "type": self.type,
            "label": EFFECT_LABELS[et] if et else self.type,
            "target": self.target,
            "value": self.value,
            "turns": self.turns,
            "chance": self.chance,
            "count": self.count,
            "is_buff": bool(et and is_buff(et)) or self.type == EffectOp.CLEANSE.value,
            "description": self.describe(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EffectSpec":
        return cls(
            type=data["type"],
            target=data.get("target", "hit"),
            value=float(data.get("value", 0.0)),
            turns=int(data.get("turns", 2)),
            chance=float(data.get("chance", 1.0)),
            count=int(data.get("count", 1)),
        )


class PassiveKind(str, Enum):
    STACK_ON_TURN_END = "STACK_ON_TURN_END"        # +value% stat per own turn, up to max_stacks
    PER_ALLY_TROOP = "PER_ALLY_TROOP"              # +value% stat per living allied troop pack (all lanes)
    LOW_HP = "LOW_HP"                              # +value% stat while HP below threshold
    LANE_AURA = "LANE_AURA"                        # allies in the same lane get +value% stat
    REGEN = "REGEN"                                # heal value x max HP at turn start (lane_wide: whole lane)
    SHIELD_REGEN = "SHIELD_REGEN"                  # restore value x max shields at turn start
    ON_KILL_METER = "ON_KILL_METER"                # gain value turn meter (0-100) on a kill
    ON_HIT_EFFECT = "ON_HIT_EFFECT"                # abilities may apply `effect` to targets hit
    DAMAGE_VS_DEBUFFED = "DAMAGE_VS_DEBUFFED"      # +value damage against debuffed targets
    BATTLE_START_EFFECT = "BATTLE_START_EFFECT"    # applies `effect` to lane allies at battle start


@dataclass
class Passive:
    id: str
    name: str
    description: str
    kind: PassiveKind
    stat: Optional[str] = None
    value: float = 0.0
    max_stacks: int = 0
    threshold: float = 0.0
    lane_wide: bool = False
    effect: Optional[EffectSpec] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "kind": self.kind.value,
            "stat": self.stat,
            "value": self.value,
            "max_stacks": self.max_stacks,
            "threshold": self.threshold,
            "lane_wide": self.lane_wide,
            "effect": self.effect.to_dict() if self.effect else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Passive":
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            kind=PassiveKind(data["kind"]),
            stat=data.get("stat"),
            value=float(data.get("value", 0.0)),
            max_stacks=int(data.get("max_stacks", 0)),
            threshold=float(data.get("threshold", 0.0)),
            lane_wide=bool(data.get("lane_wide", False)),
            effect=EffectSpec.from_dict(data["effect"]) if data.get("effect") else None,
        )
