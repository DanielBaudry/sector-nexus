import random
import uuid
from typing import Any, Dict, List, Optional

from src.domain.entities.battle import LANE_COUNT, LANE_NAMES, Battle, LaneUnit, Objective, Wave
from src.domain.entities.biome import Biome
from src.domain.entities.boss_encounter import BossEncounter
from src.domain.entities.expedition_run import MapNode
from src.domain.services.loot_service import LootService
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.status_effect import EffectSpec, Passive
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
    effects=[EffectSpec("ATK_DOWN", "hit", 0.20, 2, 0.5)],
)


class EncounterFactory:
    """
    Turns a biome's enemy pool into a 3-lane encounter for a map node:
    starting enemies per lane, scripted reinforcement waves and objectives.
    Non-elite pool entries become troop packs; elite entries become enemy heroes.
    """

    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def build(self, biome: Biome, node: MapNode, difficulty: int = 1) -> Battle:
        diff = Difficulty(difficulty)
        self._diff = diff
        # Strength: biome tier (recommended power) x depth on the map x difficulty tier.
        biome_tier = 0.6 + biome.recommended_power / 2000.0
        mult = biome_tier * (1.0 + 0.18 * max(0, node.threat - 1)) * diff.enemy_mult
        grunts = [p for p in biome.enemy_pool if not p.get("is_elite")] or biome.enemy_pool
        elites = [p for p in biome.enemy_pool if p.get("is_elite")] or biome.enemy_pool
        # Difficulty-unlocked threats: new troops join the grunt pool (twice, so they show up often),
        # new elites take at least one elite slot, the tier-10 boss replaces the regular apex.
        tier_troops = biome.tier_enemies(diff.tier, "troop")
        tier_elites = biome.tier_enemies(diff.tier, "elite")
        tier_bosses = biome.tier_enemies(diff.tier, "boss")
        grunts = grunts + tier_troops * 2
        self._summon_templates: Dict[str, TroopTemplate] = {}

        units: List[LaneUnit] = []
        waves: List[Wave] = []
        objectives: List[Objective] = []
        rewards: Dict[str, int]

        if node.type == NodeType.BOSS:
            mult += 0.15
            boss_proto = self.rng.choice(tier_bosses) if tier_bosses else self.rng.choice(elites + tier_elites)
            units.append(self._hero(boss_proto, mult, lane=1, boss=True))
            if tier_elites and diff.tier >= 8:
                units.append(self._hero(self.rng.choice(tier_elites), mult, lane=self.rng.choice([0, 2])))
            for lane in range(LANE_COUNT):
                units.append(self._pack(self.rng.choice(grunts), mult, lane))
            for i, turn in enumerate((7, 14, 21)):
                lane = [0, 2, 1][i]
                waves.append(Wave(turn=turn, lane=lane, units=[self._pack(self.rng.choice(grunts), mult)]))
            objectives.append(Objective(ObjectiveType.ELIMINATE_BOSS, True, "Eliminate the apex threat"))
            rewards = {"credits": self.rng.randint(1200, 2000), "crystals": self.rng.randint(60, 110)}

        elif node.type == NodeType.ELITE:
            mult += 0.15
            elite_lanes = self.rng.sample(range(LANE_COUNT), 2)
            for lane in range(LANE_COUNT):
                if lane in elite_lanes:
                    pool = tier_elites if (tier_elites and lane == elite_lanes[0]) else elites + tier_elites
                    units.append(self._hero(self.rng.choice(pool), mult, lane))
                units.append(self._pack(self.rng.choice(grunts), mult, lane))
            waves.append(Wave(turn=10, lane=self.rng.randrange(LANE_COUNT), units=[self._pack(self.rng.choice(grunts), mult)]))
            objectives.append(Objective(ObjectiveType.CLEAR_LANES, True, "Clear at least 2 lanes", {"count": 2, "progress": 0}))
            rewards = {"credits": self.rng.randint(400, 700), "crystals": self.rng.randint(20, 45)}

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
            # High tiers: a difficulty elite may lead one lane of a regular fight.
            if tier_elites and diff.tier >= 8 and self.rng.random() < 0.4:
                units.append(self._hero(self.rng.choice(tier_elites), mult, self.rng.randrange(LANE_COUNT)))
            rewards = {"credits": self.rng.randint(180, 340), "crystals": self.rng.randint(0, 12)}

        # Extra reinforcements on higher tiers (boss/elite fights included).
        last_turn = max((w.turn for w in waves), default=4)
        for i in range(diff.extra_waves):
            waves.append(Wave(
                turn=last_turn + 4 * (i + 1), lane=self.rng.randrange(LANE_COUNT),
                units=[self._pack(self.rng.choice(grunts), mult)],
            ))

        rewards = {k: int(v * diff.reward_mult) for k, v in rewards.items()}
        rewards.update(LootService(self.rng).node_loot(biome, node.type, node.threat, diff.tier))

        return Battle(
            id=f"bat_{uuid.uuid4().hex[:8]}",
            node_id=node.id,
            status=BattleStatus.DEPLOYMENT,
            units=units,
            waves=waves,
            objectives=objectives,
            rewards=rewards,
            log=[f"📡 Contact at node {node.id}: {', '.join(o.description for o in objectives)}."],
            summon_templates=dict(self._summon_templates),
        )

    def build_boss(self, boss: BossEncounter, biome: Biome, node: MapNode, difficulty: int = 1) -> Battle:
        """A colossal boss standing across all three lanes; its adds arrive through abilities and phases."""
        diff = Difficulty(difficulty)
        self._diff = diff
        mult = diff.enemy_mult
        summon_templates = {
            template_id: TroopTemplate(
                id=template_id, name=s["name"], faction="Hostile", count=s["count"],
                unit_hp=max(1, int(s["unit_hp"] * mult)), unit_attack=max(1, int(s["unit_attack"] * mult)),
                defense=s.get("defense", 5),
            )
            for template_id, s in boss.summons.items()
        }
        hp = int(boss.hp * mult)
        shields = int(boss.shields * mult)
        unit = LaneUnit(
            id=f"boss_{uuid.uuid4().hex[:6]}",
            kind=UnitKind.HERO,
            side=Side.ENEMY,
            name=boss.name,
            title=boss.title,
            hp=hp, max_hp=hp, shields=shields, max_shields=shields,
            attack=int(boss.attack * mult),
            defense=boss.defense,
            speed=boss.speed,
            crit_rate=boss.crit_rate,
            lane=1,
            faction="Hostile",
            is_elite=True,
            is_boss=True,
            spans_lanes=True,
            cards=[CombatCard.from_dict({"energy_cost": 0, **a}) for a in boss.abilities],
            phases=[dict(p) for p in boss.phases],
            accuracy=boss.accuracy + 12 * diff.step,
            resistance=boss.resistance + 12 * diff.step,
            passive=Passive.from_dict(boss.passive) if boss.passive else None,
            avatar_color=boss.color,
        )
        rewards = {k: int(v * diff.reward_mult) for k, v in boss.rewards.items()}
        rewards.update(LootService(self.rng).node_loot(biome, NodeType.BOSS, node.threat, diff.tier))
        return Battle(
            id=f"bat_{uuid.uuid4().hex[:8]}",
            node_id=node.id,
            status=BattleStatus.DEPLOYMENT,
            units=[unit],
            objectives=[Objective(ObjectiveType.ELIMINATE_BOSS, True, f"Slay {boss.name}, {boss.title}")],
            rewards=rewards,
            max_turns=400,
            log=[f"🐉 {boss.name}, {boss.title}, rises across the whole front. Deploy your heroes."],
            summon_templates=summon_templates,
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
        pack = LaneUnit.troop_from_template(
            unit_id=f"en_{uuid.uuid4().hex[:6]}", template=template, side=Side.ENEMY, lane=lane, power_mult=mult,
        )
        step = self._diff.step if hasattr(self, "_diff") else 0
        pack.accuracy = 10 + 8 * step
        pack.resistance = 15 + 10 * step
        return pack

    def _hero(self, proto: Dict[str, Any], mult: float, lane: int, boss: bool = False) -> LaneUnit:
        hp_mult = mult * (2.6 if boss else 1.0)
        max_hp = int(proto.get("max_hp", proto.get("hp", 400)) * hp_mult)
        max_shields = int(proto.get("max_shields", proto.get("shields", 0)) * hp_mult)
        step = self._diff.step if hasattr(self, "_diff") else 0
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
            cards=self._cards(proto, mult, boss),
            accuracy=20 + 12 * step + (20 if boss else 0),
            resistance=20 + 12 * step + (30 if boss else 0),
            passive=Passive.from_dict(proto["passive"]) if proto.get("passive") else None,
        )

    def _cards(self, proto: Dict[str, Any], mult: float, boss: bool) -> List[CombatCard]:
        cards = [CombatCard.from_dict({"energy_cost": 0, **c}) for c in proto.get("cards", [])]
        # Enemy summons scale with the encounter like every other hostile.
        for template_id, summon in proto.get("summons", {}).items():
            self._summon_templates[template_id] = TroopTemplate(
                id=template_id,
                name=summon["name"],
                faction="Hostile",
                count=summon["count"],
                unit_hp=max(1, int(summon["unit_hp"] * mult)),
                unit_attack=max(1, int(summon["unit_attack"] * mult)),
                defense=summon.get("defense", 5),
            )
        if boss and not any(c.lane_scope == LaneScope.ALL_LANES for c in cards):
            cards.insert(0, BOSS_ROAR)
        return cards
