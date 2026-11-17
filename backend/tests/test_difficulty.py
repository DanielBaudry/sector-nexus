import random

import pytest

from src.domain.entities.expedition_run import MapNode
from src.domain.services.encounter_factory import EncounterFactory
from src.domain.services.loot_service import LootService
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.enums import NodeType, Side
from src.infrastructure.database.seed_data import get_seed_biomes


def biome(biome_id="biome_char"):
    return next(b for b in get_seed_biomes() if b.id == biome_id)


def test_difficulty_bounds_and_scaling():
    with pytest.raises(ValueError):
        Difficulty(0)
    with pytest.raises(ValueError):
        Difficulty(11)
    low, high = Difficulty(1), Difficulty(10)
    assert high.enemy_mult > low.enemy_mult == 1.0
    assert high.reward_mult > low.reward_mult == 1.0
    base = (0.45, 0.38, 0.14, 0.03)
    assert low.rarity_odds(base) == pytest.approx(base)
    assert high.rarity_odds(base)[3] > base[3] * 2
    assert sum(high.rarity_odds(base)) == pytest.approx(1.0)


def test_only_char_has_difficulty_tiers():
    assert biome("biome_char").max_difficulty == 10
    assert all(b.max_difficulty == 1 for b in get_seed_biomes() if b.id != "biome_char")


def test_new_threats_unlock_at_4_8_10():
    char = biome()
    names = lambda tier: {e["name"] for e in char.difficulty_enemies if e["min_tier"] <= tier}
    assert names(3) == set()
    assert {"Baneling Swarm", "Swarm Queen"} <= names(4)
    assert {"Ultralisk Vanguard", "Lurker Ambusher"} <= names(8) - names(7)
    assert {"Brood Lord", "Primal Tyrant"} <= names(10) - names(9)


def test_tier_10_boss_is_primal_tyrant_with_abilities():
    node = MapNode(id="b", row=6, col=1, type=NodeType.BOSS, threat=6)
    battle = EncounterFactory(random.Random(1)).build(biome(), node, difficulty=10)
    boss = next(u for u in battle.units if u.is_boss)
    assert "Primal Tyrant" in boss.name
    assert {c.name for c in boss.cards} >= {"Magma Eruption", "Primal Regeneration", "Brood Call"}
    assert "enemy_broodlings" in battle.summon_templates


def test_enemies_stronger_and_rewards_bigger_with_difficulty():
    node = MapNode(id="c", row=2, col=1, type=NodeType.COMBAT, threat=2)
    def power_and_credits(tier):
        battle = EncounterFactory(random.Random(7)).build(biome(), node, difficulty=tier)
        hp = sum(u.max_hp for u in battle.units if u.side == Side.ENEMY) / max(1, len([u for u in battle.units if u.side == Side.ENEMY]))
        return hp, battle.rewards["credits"]
    hp1, cr1 = power_and_credits(1)
    hp5, cr5 = power_and_credits(5)
    assert hp5 > hp1 * 1.5
    assert cr5 > cr1


def test_loot_better_on_high_difficulty():
    char = biome()
    def avg_rank(tier):
        loot = LootService(random.Random(3))
        ranks = [loot.roll_rank(char, NodeType.COMBAT, 1, tier) for _ in range(400)]
        return sum(ranks) / len(ranks)
    assert avg_rank(10) > avg_rank(1) + 1
