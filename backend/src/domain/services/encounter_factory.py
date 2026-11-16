import random
import uuid
from typing import Any, Dict, List, Optional

from src.domain.entities.battle import LANE_COUNT, LANE_NAMES, Battle, LaneUnit, Objective, Wave
from src.domain.entities.biome import Biome
from src.domain.entities.expedition_run import MapNode
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import (
    BattleStatus,
    LaneScope,
    NodeType,
    ObjectiveType,
    Side,
    TargetType,
    UnitKind,
)
from src.domain.value_objects.troop import TroopTemplate

BOSS_ROAR = CombatCard(
    id="boss_apex_roar",
    name="Apex Onslaught",
    description="The apex threat lashes out across every lane.",
    energy_cost=0,
    target_type=TargetType.ALL_ENEMIES,
    power_multiplier=0.55,
    cooldown_turns=2,
    lane_scope=LaneScope.ALL_LANES,
)


class EncounterFactory:
    """
    Turns a biome's enemy pool into a 3-lane encounter for a map node:
    starting enemies per lane, scripted reinforcement waves and objectives.
    Non-elite pool entries become troop packs; elite entries become enemy heroes.
    """

    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def build(self, biome: Biome, node: MapNode) -> Battle:
        # Difficulty: biome tier (recommended power) x depth on the map.
        biome_tier = 0.6 + biome.recommended_power / 2000.0
        mult = biome_tier * (1.0 + 0.18 * max(0, node.threat - 1))
        grunts = [p for p in biome.enemy_pool if not p.get("is_elite")] or biome.enemy_pool
        elites = [p for p in biome.enemy_pool if p.get("is_elite")] or biome.enemy_pool

        units: List[LaneUnit] = []
        waves: List[Wave] = []
        objectives: List[Objective] = []
        rewards: Dict[str, int]

        if node.type == NodeType.BOSS:
            mult += 0.15
            units.append(self._hero(self.rng.choice(elites), mult, lane=1, boss=True))
            for lane in range(LANE_COUNT):
                units.append(self._pack(self.rng.choice(grunts), mult, lane))
            for i, turn in enumerate((7, 14, 21)):
                lane = [0, 2, 1][i]
                waves.append(Wave(turn=turn, lane=lane, units=[self._pack(self.rng.choice(grunts), mult)]))
            objectives.append(Objective(ObjectiveType.ELIMINATE_BOSS, True, "Eliminate the apex threat"))
            rewards = {"credits": self.rng.randint(1200, 2000), "crystals": self.rng.randint(60, 110), "experience": self.rng.randint(400, 700)}

        elif node.type == NodeType.ELITE:
            mult += 0.15
            elite_lanes = self.rng.sample(range(LANE_COUNT), 2)
            for lane in range(LANE_COUNT):
                if lane in elite_lanes:
                    units.append(self._hero(self.rng.choice(elites), mult, lane))
                units.append(self._pack(self.rng.choice(grunts), mult, lane))
            waves.append(Wave(turn=10, lane=self.rng.randrange(LANE_COUNT), units=[self._pack(self.rng.choice(grunts), mult)]))
            objectives.append(Objective(ObjectiveType.CLEAR_LANES, True, "Clear at least 2 lanes", {"count": 2, "progress": 0}))
            rewards = {"credits": self.rng.randint(400, 700), "crystals": self.rng.randint(20, 45), "experience": self.rng.randint(150, 260)}

        else:  # COMBAT
            variant = self.rng.choice(["assault", "assault", "hold", "survive"])
            for lane in range(LANE_COUNT):
                for _ in range(self.rng.randint(1, 2) if variant != "survive" else 1):
                    units.append(self._pack(self.rng.choice(grunts), mult, lane))

            if variant == "assault":
                waves.append(Wave(turn=8, lane=self.rng.randrange(LANE_COUNT), units=[self._pack(self.rng.choice(grunts), mult)]))
                objectives.append(Objective(ObjectiveType.CLEAR_LANES, True, "Clear at least 2 lanes", {"count": 2, "progress": 0}))
            elif variant == "hold":
                lane = self.rng.randrange(LANE_COUNT)
                for turn in (6, 12):
                    waves.append(Wave(turn=turn, lane=lane, units=[self._pack(self.rng.choice(grunts), mult)]))
                objectives.append(Objective(ObjectiveType.CLEAR_LANES, True, "Clear at least 2 lanes", {"count": 2, "progress": 0}))
                objectives.append(Objective(
                    ObjectiveType.DEFEND_LANE, False,
                    f"Hold {LANE_NAMES[lane]} — keep at least one unit alive there", {"lane": lane},
                ))
            else:
                turns = 20
                for turn in range(5, turns, 5):
                    waves.append(Wave(turn=turn, lane=self.rng.randrange(LANE_COUNT), units=[self._pack(self.rng.choice(grunts), mult)]))
                objectives.append(Objective(
                    ObjectiveType.SURVIVE_TURNS, True, f"Survive {turns} turns until extraction",
                    {"turns": turns, "progress": 0},
                ))
            rewards = {"credits": self.rng.randint(180, 340), "crystals": self.rng.randint(0, 12), "experience": self.rng.randint(70, 140)}

        return Battle(
            id=f"bat_{uuid.uuid4().hex[:8]}",
            node_id=node.id,
            status=BattleStatus.DEPLOYMENT,
            units=units,
            waves=waves,
            objectives=objectives,
            rewards=rewards,
            log=[f"📡 Contact at node {node.id}: {', '.join(o.description for o in objectives)}."],
        )

    # ── Unit factories ──────────────────────────────────────────────────────
    def _pack(self, proto: Dict[str, Any], mult: float, lane: Optional[int] = None) -> LaneUnit:
        total_hp = proto.get("hp", 200) + proto.get("shields", 0)
        count = 4 if total_hp >= 300 else 6
        template = TroopTemplate(
            id=f"enemy_{proto.get('name', 'unit').lower().replace(' ', '_')}",
            name=proto.get("name", "Hostiles"),
            faction="Hostile",
            count=count,
            unit_hp=max(1, total_hp // count),
            unit_attack=max(1, round(proto.get("attack", 20) / count)),
            defense=proto.get("defense", 10),
        )
        return LaneUnit.troop_from_template(
            unit_id=f"en_{uuid.uuid4().hex[:6]}", template=template, side=Side.ENEMY, lane=lane, power_mult=mult,
        )

    def _hero(self, proto: Dict[str, Any], mult: float, lane: int, boss: bool = False) -> LaneUnit:
        hp_mult = mult * (2.6 if boss else 1.0)
        max_hp = int(proto.get("max_hp", proto.get("hp", 400)) * hp_mult)
        max_shields = int(proto.get("max_shields", proto.get("shields", 0)) * hp_mult)
        return LaneUnit(
            id=f"en_{uuid.uuid4().hex[:6]}",
            kind=UnitKind.HERO,
            side=Side.ENEMY,
            name=("Apex " if boss else "") + proto.get("name", "Commander"),
            hp=max_hp,
            max_hp=max_hp,
            shields=max_shields,
            max_shields=max_shields,
            attack=int(proto.get("attack", 40) * mult),
            defense=proto.get("defense", 30),
            speed=proto.get("speed", 90),
            lane=lane,
            faction="Hostile",
            is_elite=True,
            is_boss=boss,
            cards=[BOSS_ROAR] if boss else [],
        )
