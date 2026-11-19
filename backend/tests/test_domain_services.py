import pytest
from src.domain.value_objects.enums import Faction, Rarity, Role, GambitCondition, TargetType
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.gambit import GambitRule
from src.domain.services.gambit_evaluator import GambitEvaluator
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


def test_warpcopy_prints_a_fresh_champion_from_blueprint_and_materials():
    import pytest
    from src.domain.entities.hero_archive import HeroArchive
    from src.domain.services.warp_forge_service import PRINT_COST, WarpForgeService

    template = get_seed_champion_templates()[0]
    archive = HeroArchive()
    with pytest.raises(ValueError, match="No blueprint"):
        WarpForgeService.warpcopy(archive, template)
    archive.add({"blueprints": [template.template_id], "hero_materials": {template.template_id: PRINT_COST - 1}})
    with pytest.raises(ValueError, match="print materials"):
        WarpForgeService.warpcopy(archive, template)
    archive.add({"hero_materials": {template.template_id: 31}})
    champ = WarpForgeService.warpcopy(archive, template)
    assert champ.id.startswith("champ_") and champ.level == 1 and champ.template_id == template.template_id
    assert len(champ.cards) > 0
    assert archive.materials_for(template.template_id) == 30
    assert template.template_id in archive.blueprints  # the blueprint is kept


def test_warp_loot_rolls_blueprints_and_materials():
    import random
    from src.domain.services.warp_forge_service import WarpForgeService

    forge = WarpForgeService(random.Random(3))
    pool = ["a", "b", "c"]
    seen_blueprint = False
    for _ in range(40):
        loot = forge.archive_loot(pool, known={"a"})
        assert set(loot["blueprints"]) <= {"b", "c"}
        assert loot["hero_materials"] and all(15 <= n <= 60 for n in loot["hero_materials"].values())
        seen_blueprint |= bool(loot["blueprints"])
    assert seen_blueprint
    assert forge.boss_loot(pool, known=set(pool))["blueprints"] == []  # nothing left to find
    assert forge.archive_loot([], known=set()) == {}
