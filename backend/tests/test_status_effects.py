import random

from src.domain.entities.battle import Battle, LaneUnit, Objective
from src.domain.services.lane_battle_engine import LaneBattleEngine
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import BattleStatus, LaneScope, ObjectiveType, Side, TargetType, UnitKind
from src.domain.value_objects.status_effect import (
    EffectSpec,
    EffectType,
    Passive,
    PassiveKind,
    StatusEffect,
    debuff_land_chance,
)
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.repositories.hero_kit_repository_seed import HeroKitRepositorySeed

GRUNTS = TroopTemplate("grunt", "Grunts", "Hostile", count=4, unit_hp=20, unit_attack=4, defense=0)
MARINES = TroopTemplate("troop_marine", "Marines", "Terran Vanguard", count=6, unit_hp=35, unit_attack=6, defense=12)


def hero(uid="h1", lane=1, side=Side.ALLY, cards=None, attack=50, hp=600, speed=100, **kw):
    return LaneUnit(
        id=uid, kind=UnitKind.HERO, side=side, name=uid, hp=hp, max_hp=hp,
        attack=attack, defense=10, speed=speed, crit_rate=0.0, lane=lane, cards=cards or [], **kw,
    )


def battle_of(units):
    return Battle(
        id="b", node_id="n", status=BattleStatus.IN_PROGRESS, units=units,
        objectives=[Objective(ObjectiveType.CLEAR_LANES, True, "Clear 3", {"count": 3})],
    )


def card(cid="c", effects=None, power=1.0, target=TargetType.SINGLE_ENEMY, scope=LaneScope.SAME_LANE, heal=0.0):
    return CombatCard(id=cid, name=cid, description="", energy_cost=0, target_type=target,
                      power_multiplier=power, heal_multiplier=heal, lane_scope=scope, effects=effects or [])


def test_land_chance_drops_with_resistance_gap():
    assert debuff_land_chance(0.8, 100, 50) == 0.8           # accuracy above resistance: base chance
    assert debuff_land_chance(0.8, 50, 100) < 0.8
    assert debuff_land_chance(1.0, 0, 1000) == 0.05          # floor


def test_buff_raises_effective_attack_and_refreshes_instead_of_stacking():
    engine = LaneBattleEngine(random.Random(1))
    h = hero()
    b = battle_of([h, hero("e", side=Side.ENEMY)])
    engine._apply_spec(b, h, h, EffectSpec("ATK_UP", "self", 0.5, 2))
    assert b.effective(h, "attack") == 75
    engine._apply_spec(b, h, h, EffectSpec("ATK_UP", "self", 0.3, 3))
    atk_ups = [e for e in h.effects if e.type == EffectType.ATK_UP]
    assert len(atk_ups) == 1 and atk_ups[0].value == 0.5 and atk_ups[0].turns == 3


def test_effect_lasts_the_holders_turns_and_fresh_self_buff_skips_first_tick():
    engine = LaneBattleEngine(random.Random(1))
    h = hero()
    b = battle_of([h, hero("e", side=Side.ENEMY)])
    engine._acting_id = h.id
    engine._apply_spec(b, h, h, EffectSpec("DEF_UP", "self", 0.5, 2))
    engine._end_turn(b, h)          # the turn it was cast
    assert h.effects[0].turns == 2
    engine._end_turn(b, h)
    engine._end_turn(b, h)
    assert not h.effects


def test_debuff_resisted_and_immunity_blocks():
    engine = LaneBattleEngine(random.Random(1))
    caster = hero("c", accuracy=0)
    tank = hero("t", side=Side.ENEMY, resistance=1000)
    b = battle_of([caster, tank])
    engine._apply_spec(b, caster, tank, EffectSpec("DEF_DOWN", "hit", 0.3, 2, chance=0.5))
    assert not tank.effects
    assert b.events[-1]["action"] == "resisted"

    target = hero("i", side=Side.ENEMY, resistance=0)
    target.effects.append(StatusEffect(EffectType.IMMUNITY, 0, 2))
    b.units.append(target)
    engine._apply_spec(b, caster, target, EffectSpec("STUN", "hit", 0, 1, chance=1.0))
    assert not target.has_effect(EffectType.STUN)


def test_cleanse_strip_and_steal():
    engine = LaneBattleEngine(random.Random(2))
    me = hero("me", accuracy=500)
    foe = hero("foe", side=Side.ENEMY)
    b = battle_of([me, foe])
    me.effects.append(StatusEffect(EffectType.DEF_DOWN, 0.3, 2))
    engine._apply_spec(b, me, me, EffectSpec("CLEANSE", "self"))
    assert not me.debuffs

    foe.effects += [StatusEffect(EffectType.ATK_UP, 0.5, 2), StatusEffect(EffectType.DEF_UP, 0.5, 2)]
    engine._apply_spec(b, me, foe, EffectSpec("STEAL", "hit", count=1))
    assert len(foe.buffs) == 1 and len(me.buffs) == 1
    engine._apply_spec(b, me, foe, EffectSpec("STRIP", "hit", count=1))
    assert not foe.buffs


def test_stunned_ally_hero_skips_its_turn_automatically():
    engine = LaneBattleEngine(random.Random(1))
    h = hero(speed=300)
    foe = hero("e", side=Side.ENEMY, speed=1)
    h.effects.append(StatusEffect(EffectType.STUN, 0, 1))
    b = battle_of([h, foe])
    b.status = BattleStatus.DEPLOYMENT
    engine.begin(b, now=0, max_actions=1)
    assert not h.has_effect(EffectType.STUN)
    assert any(e["type"] == "effect" and e["action"] == "skip" for e in b.events)


def test_dot_damages_at_turn_start_and_can_kill():
    engine = LaneBattleEngine(random.Random(1))
    h = hero(hp=100)
    h.hp = 5
    b = battle_of([h, hero("e", side=Side.ENEMY)])
    h.effects.append(StatusEffect(EffectType.BURN, 0.1, 2))
    assert engine._start_turn(b, h) == "dead"
    assert not h.is_alive


def test_heal_block_and_marked():
    engine = LaneBattleEngine(random.Random(1))
    h = hero(hp=100)
    h.hp = 50
    b = battle_of([h, hero("e", side=Side.ENEMY, hp=1000)])
    h.effects.append(StatusEffect(EffectType.HEAL_BLOCK, 0, 2))
    engine._heal(b, h, h, 30)
    assert h.hp == 50

    foe = b.units[1]
    engine._strike(b, h, foe, 100, can_crit=False)
    plain = 1000 - foe.hp
    foe.hp = 1000
    foe.effects.append(StatusEffect(EffectType.MARKED, 0.25, 2))
    engine._strike(b, h, foe, 100, can_crit=False)
    assert 1000 - foe.hp > plain


def test_passives_stack_aura_troops_and_low_hp():
    engine = LaneBattleEngine(random.Random(1))
    duke = hero("duke", passive=Passive("p", "Entrenched", "", PassiveKind.STACK_ON_TURN_END, "defense", 0.04, max_stacks=2))
    b = battle_of([duke, hero("e", side=Side.ENEMY)])
    for _ in range(3):
        engine._end_turn(b, duke)
    assert duke.passive_stacks == 2
    assert b.modifier_pct(duke, "defense") == 0.08

    kerrigan = hero("k", lane=0, passive=Passive("q", "Swarm", "", PassiveKind.PER_ALLY_TROOP, "attack", 0.06))
    raynor = hero("r", lane=0, passive=Passive("a", "Aura", "", PassiveKind.LANE_AURA, "attack", 0.12))
    packs = [LaneUnit.troop_from_template(f"t{i}", MARINES, Side.ALLY, lane=i) for i in range(3)]
    b2 = battle_of([kerrigan, raynor, *packs, hero("e", side=Side.ENEMY)])
    assert abs(b2.modifier_pct(kerrigan, "attack") - (0.18 + 0.12)) < 1e-9   # 3 packs + Raynor's aura
    assert b2.modifier_pct(packs[0], "attack") == 0.12                     # same lane as Raynor
    assert b2.modifier_pct(packs[1], "attack") == 0.0

    dehaka = hero("d", passive=Passive("r", "Rage", "", PassiveKind.LOW_HP, "attack", 0.4, threshold=0.5))
    b3 = battle_of([dehaka, hero("e", side=Side.ENEMY)])
    assert b3.modifier_pct(dehaka, "attack") == 0
    dehaka.hp = 100
    assert b3.modifier_pct(dehaka, "attack") == 0.4


def test_on_kill_meter_passive():
    engine = LaneBattleEngine(random.Random(1))
    z = hero("z", attack=500, passive=Passive("v", "Void", "", PassiveKind.ON_KILL_METER, value=50))
    weak = LaneUnit.troop_from_template("g", GRUNTS, Side.ENEMY, lane=1)
    b = battle_of([z, weak, hero("e", side=Side.ENEMY, lane=2)])
    engine._strike(b, z, weak, 5000, can_crit=False)
    assert z.turn_meter == 50


def test_ability_applies_effects_to_targets_hit():
    engine = LaneBattleEngine(random.Random(3))
    h = hero(accuracy=500, cards=[card("slash", [EffectSpec("DEF_DOWN", "hit", 0.3, 2, 1.0)])])
    foe = hero("e", side=Side.ENEMY, hp=5000)
    b = battle_of([h, foe])
    b.current_actor_id = h.id
    engine.play_ally_turn(b, card_id="slash", now=0, max_actions_after=0)
    assert foe.has_effect(EffectType.DEF_DOWN)


def test_seed_kits_cover_every_hero_template():
    kit = HeroKitRepositorySeed()
    for tid in ["tmpl_terran_raynor", "tmpl_zerg_kerrigan", "tmpl_protoss_zeratul", "tmpl_protoss_karax"]:
        assert kit.get_passive(tid) is not None
    assert kit.get_ability_effects()["karax_guardian_shield"][0].type == "IMMUNITY"
