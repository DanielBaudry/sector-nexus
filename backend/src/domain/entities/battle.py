import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import (
    BattleStatus,
    ObjectiveType,
    Side,
    UnitKind,
)
from src.domain.value_objects.gambit import GambitRule
from src.domain.value_objects.status_effect import STAT_MODIFIERS, EffectType, Passive, PassiveKind, StatusEffect
from src.domain.value_objects.troop import TroopTemplate

LANE_COUNT = 3
LANE_NAMES = ["LEFT FLANK", "CENTER", "RIGHT FLANK"]

# Mana: the player's shared expedition resource, spent to deploy reserve troops.
MANA_CAP = 10
MANA_FLOOR = 3            # every battle opens with at least this much
MANA_PER_TROOP_KILL = 1
MANA_PER_HERO_KILL = 2    # elites and bosses included
MANA_PER_LANE_CLEARED = 1
MANA_PER_OBJECTIVE = 2


@dataclass
class LaneUnit:
    """
    A combatant on the lane board. Heroes act on initiative (ATB);
    troops are packs of soldiers that fire a volley when their lane activates.
    """
    id: str
    kind: UnitKind
    side: Side
    name: str
    hp: int
    max_hp: int
    attack: int
    defense: int
    lane: Optional[int] = None  # None = in reserve / not deployed
    shields: int = 0
    max_shields: int = 0
    speed: int = 0
    crit_rate: float = 0.10
    crit_damage: float = 1.50
    turn_meter: float = 0.0
    is_alive: bool = True
    accuracy: int = 0
    resistance: int = 0
    effects: List[StatusEffect] = field(default_factory=list)
    passive: Optional[Passive] = None
    passive_stacks: int = 0
    # Hero fields
    title: str = ""
    faction: str = ""
    role: str = ""
    cards: List[CombatCard] = field(default_factory=list)
    gambits: List[GambitRule] = field(default_factory=list)
    cooldowns: Dict[str, int] = field(default_factory=dict)  # card_id -> own turns remaining
    avatar_color: str = "#3b82f6"
    is_elite: bool = False
    is_boss: bool = False
    actions_taken: int = 0
    # Colossal bosses stand across every lane: reachable (and acting) from all of them.
    spans_lanes: bool = False
    # Boss phases: [{"threshold", "name", "description", "bonus": {stat: pct}, "effects", "summons", "shield_pct"}]
    phases: List[Dict[str, Any]] = field(default_factory=list)
    phase: int = 0
    # Wind-up of a telegraphed boss ability: {"card_id", "name", "lanes", "turns"}
    intent: Optional[Dict[str, Any]] = None
    art: Optional[Dict[str, Any]] = None  # boss art: {"image", "hue"}
    # Troop fields
    template_id: str = ""
    unit_hp: int = 0
    unit_attack: int = 0
    owner_id: Optional[str] = None  # hero that summoned this pack (summons only)
    mana_cost: int = 0  # reserve packs: mana to deploy
    # Reserve packs: lane the pack was deployed to (it stays there for the rest of the run).
    deployed_lane: Optional[int] = None

    @property
    def is_hero(self) -> bool:
        return self.kind == UnitKind.HERO

    @property
    def is_troop(self) -> bool:
        return self.kind == UnitKind.TROOP

    @property
    def count(self) -> int:
        """Soldiers still standing in a troop pack (front soldier may be wounded)."""
        if not self.is_troop or self.unit_hp <= 0 or self.hp <= 0:
            return 0
        return math.ceil(self.hp / self.unit_hp)

    @property
    def max_count(self) -> int:
        if not self.is_troop or self.unit_hp <= 0:
            return 0
        return math.ceil(self.max_hp / self.unit_hp)

    @property
    def volley_power(self) -> int:
        return self.count * self.unit_attack if self.is_troop else self.attack

    def available_cards(self) -> List[CombatCard]:
        return [c for c in self.cards if self.cooldowns.get(c.id, 0) <= 0]

    # ── Status effects ─────────────────────────────────────────────────────
    def has_effect(self, effect_type: EffectType) -> bool:
        return any(e.type == effect_type for e in self.effects)

    @property
    def buffs(self) -> List[StatusEffect]:
        return [e for e in self.effects if e.is_buff]

    @property
    def debuffs(self) -> List[StatusEffect]:
        return [e for e in self.effects if not e.is_buff]

    def effect_total(self, effect_type: EffectType) -> float:
        return sum(e.value for e in self.effects if e.type == effect_type)

    @classmethod
    def troop_from_template(
        cls, unit_id: str, template: TroopTemplate, side: Side, owner_id: Optional[str] = None,
        lane: Optional[int] = None, power_mult: float = 1.0,
    ) -> "LaneUnit":
        unit_hp = max(1, int(template.unit_hp * power_mult))
        max_hp = unit_hp * template.count
        return cls(
            id=unit_id,
            kind=UnitKind.TROOP,
            side=side,
            name=template.name,
            hp=max_hp,
            max_hp=max_hp,
            attack=template.unit_attack,
            defense=template.defense,
            lane=lane,
            faction=template.faction,
            template_id=template.id,
            unit_hp=unit_hp,
            unit_attack=max(1, int(template.unit_attack * power_mult)),
            owner_id=owner_id,
            resistance=20,
            mana_cost=template.mana_cost,
        )

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "kind": self.kind.value,
            "side": self.side.value,
            "name": self.name,
            "lane": self.lane,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "shields": self.shields,
            "max_shields": self.max_shields,
            "attack": self.attack,
            "defense": self.defense,
            "speed": self.speed,
            "turn_meter": round(self.turn_meter, 1),
            "is_alive": self.is_alive,
            "faction": self.faction,
            "is_elite": self.is_elite,
            "is_boss": self.is_boss,
            "accuracy": self.accuracy,
            "resistance": self.resistance,
            "effects": [e.to_dict() for e in self.effects],
            "passive": self.passive.to_dict() if self.passive else None,
            "passive_stacks": self.passive_stacks,
        }
        if self.spans_lanes or self.phases:
            data.update({
                "spans_lanes": self.spans_lanes,
                "phase": self.phase,
                "phases": [
                    {"threshold": p.get("threshold", 1.0), "name": p.get("name", ""), "description": p.get("description", "")}
                    for p in self.phases
                ],
                "intent": self.intent,
                "title": self.title,
                "art": self.art,
            })
        if self.is_hero:
            data.update({
                "title": self.title,
                "role": self.role,
                "crit_rate": self.crit_rate,
                "crit_damage": self.crit_damage,
                "avatar_color": self.avatar_color,
                "cards": [
                    {**c.to_dict(), "cooldown_remaining": self.cooldowns.get(c.id, 0)}
                    for c in self.cards
                ],
            })
        else:
            data.update({
                "template_id": self.template_id,
                "count": self.count,
                "max_count": self.max_count,
                "unit_hp": self.unit_hp,
                "unit_attack": self.unit_attack,
                "volley_power": self.volley_power,
                "owner_id": self.owner_id,
                "mana_cost": self.mana_cost,
                "deployed_lane": self.deployed_lane,
            })
        return data


@dataclass
class Objective:
    type: ObjectiveType
    is_primary: bool
    description: str
    params: Dict[str, Any] = field(default_factory=dict)
    status: str = "PENDING"  # PENDING | COMPLETE | FAILED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "is_primary": self.is_primary,
            "description": self.description,
            "params": self.params,
            "status": self.status,
        }


@dataclass
class Wave:
    """Scripted enemy reinforcement that drops into a lane once battle.turn reaches `turn`."""
    turn: int
    lane: int
    units: List[LaneUnit]
    spawned: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "turn": self.turn,
            "lane": self.lane,
            "spawned": self.spawned,
            "unit_names": [u.name for u in self.units],
        }


@dataclass
class Battle:
    id: str
    node_id: str
    status: BattleStatus
    units: List[LaneUnit] = field(default_factory=list)
    objectives: List[Objective] = field(default_factory=list)
    waves: List[Wave] = field(default_factory=list)
    summon_templates: Dict[str, TroopTemplate] = field(default_factory=dict)
    # Drill meters drive troops in lanes that have no living hero of their side.
    drill_meters: Dict[str, float] = field(default_factory=dict)  # "ALLY:0" -> meter
    turn: int = 0  # number of actions resolved so far
    max_turns: int = 150
    current_actor_id: Optional[str] = None  # set while waiting for player input
    turn_started_at: float = field(default_factory=time.time)
    turn_time_limit_seconds: float = 30.0
    log: List[str] = field(default_factory=list)
    rewards: Dict[str, int] = field(default_factory=dict)
    # Structured combat events (hits, heals, summons...) the client replays as animations.
    events: List[Dict[str, Any]] = field(default_factory=list)
    event_seq: int = 0
    mana: int = 0
    mana_cap: int = MANA_CAP
    # Lanes cleared at the last evaluation (mana is granted when a lane flips to cleared).
    cleared_lanes: List[bool] = field(default_factory=list)

    MAX_EVENTS = 300

    def emit(self, type_: str, **data: Any) -> None:
        self.event_seq += 1
        self.events.append({"seq": self.event_seq, "type": type_, **data})
        if len(self.events) > self.MAX_EVENTS:
            del self.events[: len(self.events) - self.MAX_EVENTS]

    def gain_mana(self, amount: int, reason: str, unit_id: Optional[str] = None) -> None:
        gained = max(0, min(amount, self.mana_cap - self.mana))
        if gained <= 0:
            return
        self.mana += gained
        self.emit("mana", amount=gained, mana=self.mana, reason=reason, unit_id=unit_id)

    def spend_mana(self, amount: int, reason: str, unit_id: Optional[str] = None) -> None:
        if amount > self.mana:
            raise ValueError(f"Not enough mana ({self.mana}/{amount}).")
        self.mana -= amount
        self.emit("mana", amount=-amount, mana=self.mana, reason=reason, unit_id=unit_id)

    # ── Queries ────────────────────────────────────────────────────────────
    def get_unit(self, unit_id: str) -> Optional[LaneUnit]:
        return next((u for u in self.units if u.id == unit_id), None)

    def living(self, side: Side, lane: Optional[int] = None) -> List[LaneUnit]:
        return [
            u for u in self.units
            if u.side == side and u.is_alive and u.lane is not None
            and (lane is None or u.lane == lane or u.spans_lanes)
        ]

    def lane_hero(self, side: Side, lane: int) -> Optional[LaneUnit]:
        return next((u for u in self.living(side, lane) if u.is_hero), None)

    def front_target(self, attacker_side: Side, lane: int) -> Optional[LaneUnit]:
        """Troops screen their hero: the first living enemy troop is hit before the hero."""
        defenders = self.living(Side.ENEMY if attacker_side == Side.ALLY else Side.ALLY, lane)
        troops = [u for u in defenders if u.is_troop]
        if troops:
            return troops[0]
        return defenders[0] if defenders else None

    # ── Stat rules (buffs / debuffs / passives) ─────────────────────────────
    def modifier_pct(self, unit: LaneUnit, stat: str) -> float:
        """Sum of percentage modifiers on `stat` from effects, the unit's passive and lane auras."""
        pct = 0.0
        for e in unit.effects:
            mod = STAT_MODIFIERS.get(e.type)
            if mod and mod[0] == stat:
                pct += mod[1] * e.value
        if unit.phases and 0 <= unit.phase < len(unit.phases):
            pct += unit.phases[unit.phase].get("bonus", {}).get(stat, 0.0)
        p = unit.passive
        if p and p.stat == stat:
            if p.kind == PassiveKind.STACK_ON_TURN_END:
                pct += p.value * unit.passive_stacks
            elif p.kind == PassiveKind.PER_ALLY_TROOP:
                pct += p.value * sum(1 for u in self.living(unit.side) if u.is_troop)
            elif p.kind == PassiveKind.LOW_HP and unit.hp < unit.max_hp * p.threshold:
                pct += p.value
        if unit.lane is not None:
            for ally in self.living(unit.side, unit.lane):
                ap = ally.passive
                if ap and ap.kind == PassiveKind.LANE_AURA and ap.stat == stat:
                    pct += ap.value
        return pct

    def effective(self, unit: LaneUnit, stat: str) -> float:
        """Stat after modifiers. Troops use their volley power as attack."""
        pct = self.modifier_pct(unit, stat)
        if stat == "crit_rate":
            return max(0.0, min(1.0, unit.crit_rate + pct))
        base = {
            "attack": unit.volley_power if unit.is_troop else unit.attack,
            "defense": unit.defense,
            "speed": unit.speed,
        }[stat]
        return max(0.0, base * max(0.1, 1.0 + pct))

    def modified_stats(self, unit: LaneUnit) -> Dict[str, Any]:
        out = {}
        for stat in ("attack", "defense", "speed"):
            pct = self.modifier_pct(unit, stat)
            if abs(pct) > 1e-6:
                out[stat] = {"value": int(round(self.effective(unit, stat))), "pct": round(pct, 3)}
        return out

    def pending_waves(self, lane: Optional[int] = None) -> List[Wave]:
        return [w for w in self.waves if not w.spawned and (lane is None or w.lane == lane)]

    def is_lane_cleared(self, lane: int) -> bool:
        return not self.living(Side.ENEMY, lane) and not self.pending_waves(lane)

    def is_lane_held(self, lane: int) -> bool:
        return bool(self.living(Side.ALLY, lane))

    @property
    def current_actor(self) -> Optional[LaneUnit]:
        return self.get_unit(self.current_actor_id) if self.current_actor_id else None

    def is_turn_timed_out(self, now: Optional[float] = None) -> bool:
        if not self.current_actor_id:
            return False
        now = time.time() if now is None else now
        return (now - self.turn_started_at) > self.turn_time_limit_seconds

    def to_dict(self) -> Dict[str, Any]:
        lanes = []
        for i in range(LANE_COUNT):
            lanes.append({
                "index": i,
                "name": LANE_NAMES[i],
                "cleared": self.is_lane_cleared(i),
                "held": self.is_lane_held(i),
                "ally_drill_meter": round(self.drill_meters.get(f"ALLY:{i}", 0.0), 1),
                "enemy_drill_meter": round(self.drill_meters.get(f"ENEMY:{i}", 0.0), 1),
                "incoming_waves": [w.to_dict() for w in self.pending_waves(i)],
            })
        return {
            "id": self.id,
            "node_id": self.node_id,
            "status": self.status.value,
            "turn": self.turn,
            "lanes": lanes,
            "units": [{**u.to_dict(), "modified": self.modified_stats(u)} for u in self.units if u.lane is not None],
            "objectives": [o.to_dict() for o in self.objectives],
            "current_actor_id": self.current_actor_id,
            "turn_started_at": self.turn_started_at,
            "turn_time_limit_seconds": self.turn_time_limit_seconds,
            "log": self.log[-40:],
            "rewards": self.rewards,
            "events": self.events[-150:],
            "event_seq": self.event_seq,
            "mana": self.mana,
            "mana_cap": self.mana_cap,
        }
