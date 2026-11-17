import random

from src.domain.entities.battle import Battle, LaneUnit, Objective, Wave
from src.domain.services.lane_battle_engine import LaneBattleEngine
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import BattleStatus, LaneScope, ObjectiveType, Side, TargetType, UnitKind
from src.domain.value_objects.status_effect import EffectType, StatusEffect
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.database.seed_data import get_seed_boss_encounters

GRUNTS = TroopTemplate("grunt", "Grunts", "Hostile", count=4, unit_hp=20, unit_attack=4, defense=0)
SLAM = CombatCard(
    id="slam", name="Slam", description="", energy_cost=0, target_type=TargetType.ALL_ENEMIES,
    power_multiplier=2.0, cooldown_turns=3, lane_scope=LaneScope.ANY_LANE, telegraph_turns=1,
)


def hero(uid, lane, attack=50, hp=600, speed=100):
    return LaneUnit(id=uid, kind=UnitKind.HERO, side=Side.ALLY, name=uid, hp=hp, max_hp=hp, attack=attack,
                    defense=10, speed=speed, crit_rate=0.0, lane=lane)


def boss(cards=None, phases=None, hp=10000):
    return LaneUnit(id="boss", kind=UnitKind.HERO, side=Side.ENEMY, name="Boss", hp=hp, max_hp=hp, attack=100,
                    defense=10, speed=90, crit_rate=0.0, lane=1, is_boss=True, is_elite=True, spans_lanes=True,
                    cards=cards or [], phases=phases or [])


def battle_of(units, objectives=None, waves=None):
    return Battle(id="b", node_id="n", status=BattleStatus.IN_PROGRESS, units=units, waves=waves or [],
                  objectives=objectives or [Objective(ObjectiveType.ELIMINATE_BOSS, True, "Kill")])


def test_spanning_boss_is_in_every_lane_and_hit_once_by_all_lane_abilities():
    b_unit = boss()
    h = hero("h", 0)
    b = battle_of([h, b_unit])
    for lane in range(3):
        assert b_unit in b.living(Side.ENEMY, lane)
    engine = LaneBattleEngine(random.Random(1))
    nova = CombatCard(id="nova", name="Nova", description="", energy_cost=0, target_type=TargetType.ALL_ENEMIES,
                      power_multiplier=1.0, lane_scope=LaneScope.ALL_LANES)
    engine._resolve_ability(b, h, nova, None)
    hits = [e for e in b.events if e["type"] == "hit" and e["target_id"] == "boss"]
    assert len(hits) == 1
    # A same-lane ability from a flank can still single out the boss.
    assert engine._validate_unit_target(b, h, CombatCard(id="x", name="x", description="", energy_cost=0,
                                        target_type=TargetType.SINGLE_ENEMY, power_multiplier=1.0), "boss") is b_unit


def test_telegraphed_ability_winds_up_then_unleashes_on_the_announced_lane():
    engine = LaneBattleEngine(random.Random(1))
    b_unit = boss(cards=[SLAM])
    left, right = hero("l", 0, hp=2000), hero("r", 2, hp=500)
    b = battle_of([left, right, b_unit])
    engine._boss_turn(b, b_unit)
    assert b_unit.intent and b_unit.intent["lanes"] == [0]   # strongest lane
    assert any(e["type"] == "telegraph" and e["action"] == "charge" for e in b.events)
    hp_before = right.hp
    engine._boss_turn(b, b_unit)
    assert b_unit.intent is None and b_unit.cooldowns["slam"] == 3
    assert any(e["type"] == "telegraph" and e["action"] == "unleash" for e in b.events)
    assert any(e["type"] == "hit" and e["target_id"] == "l" and e["damage"] > 150 for e in b.events)


def test_stun_interrupts_the_wind_up():
    engine = LaneBattleEngine(random.Random(1))
    b_unit = boss(cards=[SLAM])
    b = battle_of([hero("l", 0, hp=2000), b_unit])
    engine._boss_turn(b, b_unit)
    assert b_unit.intent
    b_unit.effects.append(StatusEffect(EffectType.STUN, 0, 1))
    engine._boss_turn(b, b_unit)
    assert b_unit.intent is None
    assert b_unit.cooldowns["slam"] == 3
    assert any(e["type"] == "telegraph" and e["action"] == "interrupted" for e in b.events)


def test_phase_shift_at_threshold_grants_bonus_and_summons():
    engine = LaneBattleEngine(random.Random(1))
    phases = [
        {"threshold": 1.0, "name": "One"},
        {"threshold": 0.5, "name": "Two", "bonus": {"attack": 0.5},
         "summons": [{"template_id": "grunt", "lanes": [0, 2]}]},
    ]
    b_unit = boss(phases=phases)
    b = battle_of([hero("l", 0), b_unit])
    b.summon_templates["grunt"] = GRUNTS
    engine._check_boss_phases(b)
    assert b_unit.phase == 0
    b_unit.hp = 4000
    engine._check_boss_phases(b)
    assert b_unit.phase == 1
    assert b.effective(b_unit, "attack") == 150
    assert sum(1 for u in b.units if u.is_troop and u.side == Side.ENEMY) == 2
    assert any(e["type"] == "phase" for e in b.events)


def test_empty_board_pulls_next_wave_and_survive_completes_when_all_waves_cleared():
    engine = LaneBattleEngine(random.Random(1))
    h = hero("h", 0)
    wave = Wave(turn=30, lane=0, units=[LaneUnit.troop_from_template("w1", GRUNTS, Side.ENEMY)])
    obj = Objective(ObjectiveType.SURVIVE_TURNS, True, "Survive", {"turns": 40, "progress": 0})
    b = battle_of([h], objectives=[obj], waves=[wave])
    engine._end_action(b)
    assert wave.spawned and b.living(Side.ENEMY)
    assert b.status == BattleStatus.IN_PROGRESS
    for u in b.living(Side.ENEMY):
        u.is_alive = False
    engine._end_action(b)
    assert obj.status == "COMPLETE" and b.status == BattleStatus.WON


def test_seed_boss_has_phases_and_telegraphs():
    zargul = get_seed_boss_encounters()[0]
    assert len(zargul.phases) == 3
    assert any(a.get("telegraph_turns") for a in zargul.abilities)
    assert zargul.to_dict()["difficulty_tiers"]
