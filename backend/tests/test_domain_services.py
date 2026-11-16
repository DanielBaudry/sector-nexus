import pytest
from src.domain.value_objects.enums import Faction, Rarity, Role, GambitCondition, TargetType
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.gambit import GambitRule
from src.domain.services.gambit_evaluator import GambitEvaluator
from src.domain.services.gacha_service import GachaService
from src.domain.services.idle_service import IdleExpeditionService
from src.domain.entities.biome import Biome
from src.domain.entities.champion import Champion
from src.domain.value_objects.stats import Stats
from src.infrastructure.database.seed_data import get_seed_champion_templates, get_seed_biomes


def test_gambit_evaluator_triggers_heal_when_ally_low_hp():
    heal_card = CombatCard(
        id="card_heal",
        name="Emergency Heal",
        description="Heals critical ally",
        energy_cost=1,
        target_type=TargetType.LOWEST_HP_ALLY,
        power_multiplier=0.0,
        heal_multiplier=1.5,
    )
    attack_card = CombatCard(
        id="card_atk",
        name="Gauss Shot",
        description="Attacks enemy",
        energy_cost=1,
        target_type=TargetType.SINGLE_ENEMY,
        power_multiplier=1.2,
    )

    gambits = [
        GambitRule(priority=1, condition=GambitCondition.ALLY_HP_UNDER_50, card_id="card_heal"),
        GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="card_atk"),
    ]

    actor = {"id": "medic", "name": "Medic Lisa", "hp": 100, "max_hp": 100, "is_alive": True}
    allies = [
        actor,
        {"id": "marine", "name": "Marine", "hp": 30, "max_hp": 100, "is_alive": True},  # 30% HP!
    ]
    enemies = [{"id": "zerg", "name": "Zergling", "hp": 50, "max_hp": 50, "is_alive": True}]

    chosen_card = GambitEvaluator.evaluate(
        gambits=gambits,
        actor=actor,
        allies=allies,
        enemies=enemies,
        available_cards=[heal_card, attack_card],
    )

    assert chosen_card is not None
    assert chosen_card.id == "card_heal"


def test_gambit_evaluator_falls_back_to_always_when_hp_high():
    heal_card = CombatCard(id="card_heal", name="Heal", description="", energy_cost=1, target_type=TargetType.LOWEST_HP_ALLY, power_multiplier=0.0)
    attack_card = CombatCard(id="card_atk", name="Gauss Shot", description="", energy_cost=1, target_type=TargetType.SINGLE_ENEMY, power_multiplier=1.2)

    gambits = [
        GambitRule(priority=1, condition=GambitCondition.ALLY_HP_UNDER_50, card_id="card_heal"),
        GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="card_atk"),
    ]

    actor = {"id": "medic", "name": "Medic Lisa", "hp": 100, "max_hp": 100, "is_alive": True}
    allies = [actor, {"id": "marine", "name": "Marine", "hp": 90, "max_hp": 100, "is_alive": True}]
    enemies = [{"id": "zerg", "name": "Zergling", "hp": 50, "max_hp": 50, "is_alive": True}]

    chosen = GambitEvaluator.evaluate(
        gambits=gambits,
        actor=actor,
        allies=allies,
        enemies=enemies,
        available_cards=[heal_card, attack_card],
    )

    assert chosen is not None
    assert chosen.id == "card_atk"


def test_gacha_service_summons_champion_and_generates_artifact():
    templates = get_seed_champion_templates()
    champ = GachaService.summon_champion(templates, banner_faction="ALL")
    assert champ.id.startswith("champ_")
    assert champ.level == 1
    assert len(champ.cards) > 0

    art = GachaService.generate_random_artifact()
    assert art.id.startswith("art_")
    assert art.main_stat_value > 0


def test_idle_service_calculates_rewards():
    biomes = get_seed_biomes()
    biome = biomes[0]
    preview = IdleExpeditionService.preview_rewards(squad_power=1000, biome=biome, duration_seconds=120)
    assert preview["estimated_credits"] > 0
    assert preview["estimated_crystals"] > 0
