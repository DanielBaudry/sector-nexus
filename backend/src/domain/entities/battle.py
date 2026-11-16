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
from src.domain.value_objects.troop import TroopTemplate

LANE_COUNT = 3
LANE_NAMES = ["LEFT FLANK", "CENTER", "RIGHT FLANK"]


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
    # Troop fields
    template_id: str = ""
    unit_hp: int = 0
    unit_attack: int = 0
    owner_id: Optional[str] = None  # hero this pack was attributed to

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
        }
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

    MAX_EVENTS = 300

    def emit(self, type_: str, **data: Any) -> None:
        self.event_seq += 1
        self.events.append({"seq": self.event_seq, "type": type_, **data})
        if len(self.events) > self.MAX_EVENTS:
            del self.events[: len(self.events) - self.MAX_EVENTS]

    # ── Queries ────────────────────────────────────────────────────────────
    def get_unit(self, unit_id: str) -> Optional[LaneUnit]:
        return next((u for u in self.units if u.id == unit_id), None)

    def living(self, side: Side, lane: Optional[int] = None) -> List[LaneUnit]:
        return [
            u for u in self.units
            if u.side == side and u.is_alive and u.lane is not None
            and (lane is None or u.lane == lane)
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
            "units": [u.to_dict() for u in self.units if u.lane is not None],
            "objectives": [o.to_dict() for o in self.objectives],
            "current_actor_id": self.current_actor_id,
            "turn_started_at": self.turn_started_at,
            "turn_time_limit_seconds": self.turn_time_limit_seconds,
            "log": self.log[-40:],
            "rewards": self.rewards,
            "events": self.events[-150:],
            "event_seq": self.event_seq,
        }
