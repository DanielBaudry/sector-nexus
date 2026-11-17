from typing import List, Dict, Any
from src.domain.value_objects.enums import Faction, Rarity, Role, ArtifactSlot, ArtifactSetType, TargetType, GambitCondition
from src.domain.value_objects.stats import Stats
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.gambit import GambitRule
from src.domain.entities.champion import Champion
from src.domain.entities.biome import Biome
from src.domain.entities.artifact import Artifact
from src.domain.entities.player import PlayerProfile
from src.domain.entities.squad import Squad


def get_seed_champion_templates() -> List[Champion]:
    return [
        # --- TERRAN VANGUARD ---
        Champion(
            id="tmpl_terran_raynor",
            template_id="tmpl_terran_raynor",
            name="Jim Raynor",
            title="Rebel Marshal",
            faction=Faction.TERRAN,
            role=Role.ASSAULT,
            rarity=Rarity.LEGENDARY,
            level=1,
            experience=0,
            base_stats=Stats(hp=380, max_hp=380, shields=80, max_shields=80, attack=52, defense=32, speed=105, crit_rate=0.20, crit_damage=1.65),
            cards=[
                CombatCard(
                    id="raynor_penetrator",
                    name="Penetrator Round",
                    description="Fires a high-caliber sabot round through enemy defenses.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.6,
                    icon_name="Crosshair",
                    flavor_quote="Right between the eyes."
                ),
                CombatCard(
                    id="raynor_hyperion_barrage",
                    name="Hyperion Salvo",
                    description="Calls down an orbital laser bombardment on all enemies.",
                    energy_cost=2,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.35,
                    icon_name="Zap",
                    flavor_quote="Rain fire from above!"
                ),
                CombatCard(
                    id="raynor_inspire",
                    name="Inspire Squad",
                    description="Rallies the team, restoring HP and granting combat shields.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ALLIES,
                    power_multiplier=0.0,
                    heal_multiplier=0.8,
                    shield_grant=50,
                    icon_name="Shield",
                    flavor_quote="Give 'em some pepper!"
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_COUNT_OVER_1, card_id="raynor_hyperion_barrage"),
                GambitRule(priority=2, condition=GambitCondition.ALLY_HP_UNDER_50, card_id="raynor_inspire"),
                GambitRule(priority=3, condition=GambitCondition.ALWAYS, card_id="raynor_penetrator"),
            ],
            avatar_color="#3b82f6",
            avatar_icon="Crosshair",
        ),
        Champion(
            id="tmpl_terran_nova",
            template_id="tmpl_terran_nova",
            name="Nova Terra",
            title="Covert Ghost",
            faction=Faction.TERRAN,
            role=Role.ASSAULT,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=310, max_hp=310, shields=120, max_shields=120, attack=58, defense=22, speed=115, crit_rate=0.25, crit_damage=1.80),
            cards=[
                CombatCard(
                    id="nova_snipe",
                    name="C-20A Snipe",
                    description="Lethal precision rifle round executing single targets.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.85,
                    icon_name="Target",
                ),
                CombatCard(
                    id="nova_emp",
                    name="EMP Shockwave",
                    description="Detonates an electromagnetic pulse, devastating shields and stripping turn meter.",
                    energy_cost=2,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.2,
                    icon_name="Radio",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_IS_ELITE, card_id="nova_snipe"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="nova_emp"),
            ],
            avatar_color="#06b6d4",
            avatar_icon="Target",
        ),
        Champion(
            id="tmpl_terran_medic",
            template_id="tmpl_terran_medic",
            name="Lieutenant Lisa",
            title="Field Surgeon",
            faction=Faction.TERRAN,
            role=Role.SUPPORT,
            rarity=Rarity.RARE,
            level=1,
            experience=0,
            base_stats=Stats(hp=340, max_hp=340, shields=90, max_shields=90, attack=24, defense=35, speed=102, crit_rate=0.10, crit_damage=1.40),
            cards=[
                CombatCard(
                    id="medic_nanite_heal",
                    name="Nanite Injection",
                    description="Heals critical ally for massive hull repair.",
                    energy_cost=1,
                    target_type=TargetType.LOWEST_HP_ALLY,
                    power_multiplier=0.0,
                    heal_multiplier=1.9,
                    icon_name="Heart",
                ),
                CombatCard(
                    id="medic_optical_flare",
                    name="Optical Flare",
                    description="Flares laser blinding target enemy, dealing moderate damage.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.1,
                    icon_name="Sun",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ALLY_HP_UNDER_50, card_id="medic_nanite_heal"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="medic_optical_flare"),
            ],
            avatar_color="#10b981",
            avatar_icon="Heart",
        ),
        Champion(
            id="tmpl_terran_tank",
            template_id="tmpl_terran_tank",
            name="General Duke",
            title="Siege Operator",
            faction=Faction.TERRAN,
            role=Role.VANGUARD,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=460, max_hp=460, shields=100, max_shields=100, attack=45, defense=45, speed=88, crit_rate=0.12, crit_damage=1.50),
            cards=[
                CombatCard(
                    id="tank_siege_blast",
                    name="Shock Cannon Blast",
                    description="Devastating 120mm explosive shell slamming all foes.",
                    energy_cost=2,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.45,
                    icon_name="Bomb",
                ),
                CombatCard(
                    id="tank_fortify",
                    name="Defensive Lockdown",
                    description="Bolsters armor plates and raises heavy barrier shields.",
                    energy_cost=1,
                    target_type=TargetType.SELF,
                    power_multiplier=0.0,
                    shield_grant=90,
                    icon_name="ShieldCheck",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.SELF_SHIELD_DEPLETED, card_id="tank_fortify"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="tank_siege_blast"),
            ],
            avatar_color="#f59e0b",
            avatar_icon="ShieldCheck",
        ),

        # --- BIO-SWARM (ZERG) ---
        Champion(
            id="tmpl_zerg_kerrigan",
            template_id="tmpl_zerg_kerrigan",
            name="Sarah Kerrigan",
            title="Queen of Blades",
            faction=Faction.ZERG,
            role=Role.PSIONIC,
            rarity=Rarity.LEGENDARY,
            level=1,
            experience=0,
            base_stats=Stats(hp=390, max_hp=390, shields=70, max_shields=70, attack=60, defense=30, speed=112, crit_rate=0.22, crit_damage=1.75),
            cards=[
                CombatCard(
                    id="kerrigan_psionic_shift",
                    name="Psionic Shift",
                    description="Dashes through enemy ranks tearing through bio-armor.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.4,
                    icon_name="Zap",
                    flavor_quote="The Swarm will consume you."
                ),
                CombatCard(
                    id="kerrigan_crushing_grip",
                    name="Crushing Grip",
                    description="Lifts and crushes high-threat target in telekinetic fury.",
                    energy_cost=2,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.9,
                    icon_name="HandMetal",
                ),
                CombatCard(
                    id="kerrigan_primal_leech",
                    name="Biomass Harvest",
                    description="Drains life from target to heal herself.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.2,
                    heal_multiplier=0.9,
                    icon_name="Flame",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_IS_ELITE, card_id="kerrigan_crushing_grip"),
                GambitRule(priority=2, condition=GambitCondition.ENEMY_COUNT_OVER_1, card_id="kerrigan_psionic_shift"),
                GambitRule(priority=3, condition=GambitCondition.ALWAYS, card_id="kerrigan_primal_leech"),
            ],
            avatar_color="#8b5cf6",
            avatar_icon="Zap",
        ),
        Champion(
            id="tmpl_zerg_ultralisk",
            template_id="tmpl_zerg_ultralisk",
            name="Torrasque",
            title="Apex Behemoth",
            faction=Faction.ZERG,
            role=Role.VANGUARD,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=520, max_hp=520, shields=0, max_shields=0, attack=46, defense=50, speed=85, crit_rate=0.10, crit_damage=1.45),
            cards=[
                CombatCard(
                    id="ultra_kaiser_cleave",
                    name="Kaiser Blade Cleave",
                    description="Sweeps massive scythe blades across all front lines.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.3,
                    icon_name="Scissors",
                ),
                CombatCard(
                    id="ultra_burrow_charge",
                    name="Subterranean Slam",
                    description="Erupts from underground inflicting heavy seismic impact.",
                    energy_cost=2,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.75,
                    icon_name="Flame",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_COUNT_OVER_1, card_id="ultra_kaiser_cleave"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="ultra_burrow_charge"),
            ],
            avatar_color="#9333ea",
            avatar_icon="Scissors",
        ),
        Champion(
            id="tmpl_zerg_dehaka",
            template_id="tmpl_zerg_dehaka",
            name="Dehaka",
            title="Primal Packleader",
            faction=Faction.ZERG,
            role=Role.ASSAULT,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=430, max_hp=430, shields=0, max_shields=0, attack=54, defense=36, speed=104, crit_rate=0.18, crit_damage=1.60),
            cards=[
                CombatCard(
                    id="dehaka_drag",
                    name="Apex Tongue Drag",
                    description="Lashes out tongue dragging target into claws.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.65,
                    icon_name="Target",
                ),
                CombatCard(
                    id="dehaka_consume",
                    name="Essence Devour",
                    description="Devours enemy essence, restoring health and buffing next turn.",
                    energy_cost=1,
                    target_type=TargetType.LOWEST_HP_ALLY,
                    power_multiplier=0.0,
                    heal_multiplier=1.5,
                    icon_name="Utensils",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ALLY_HP_UNDER_50, card_id="dehaka_consume"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="dehaka_drag"),
            ],
            avatar_color="#a855f7",
            avatar_icon="Target",
        ),
        Champion(
            id="tmpl_zerg_hydralisk",
            template_id="tmpl_zerg_hydralisk",
            name="Voracious Hunter",
            title="Spine Impaler",
            faction=Faction.ZERG,
            role=Role.ASSAULT,
            rarity=Rarity.RARE,
            level=1,
            experience=0,
            base_stats=Stats(hp=330, max_hp=330, shields=0, max_shields=0, attack=48, defense=25, speed=108, crit_rate=0.20, crit_damage=1.55),
            cards=[
                CombatCard(
                    id="hydra_grooved_spines",
                    name="Grooved Spine Salvo",
                    description="Launches high-velocity bone spines at armor seams.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.55,
                    icon_name="Activity",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ALWAYS, card_id="hydra_grooved_spines"),
            ],
            avatar_color="#c084fc",
            avatar_icon="Activity",
        ),

        # --- ASTRAL TEMPLARS (PROTOSS) ---
        Champion(
            id="tmpl_protoss_artanis",
            template_id="tmpl_protoss_artanis",
            name="Hierarch Artanis",
            title="Firstborn Champion",
            faction=Faction.PROTOSS,
            role=Role.VANGUARD,
            rarity=Rarity.LEGENDARY,
            level=1,
            experience=0,
            base_stats=Stats(hp=410, max_hp=410, shields=200, max_shields=200, attack=49, defense=40, speed=100, crit_rate=0.18, crit_damage=1.60),
            cards=[
                CombatCard(
                    id="artanis_twin_blades",
                    name="Twin Psi-Blades",
                    description="Strikes with dual psychic blades infused with Khala fury.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.65,
                    icon_name="Swords",
                    flavor_quote="My life for Aiur!"
                ),
                CombatCard(
                    id="artanis_shield_overcharge",
                    name="Shield Overcharge",
                    description="Overcharges matrix shielding on self and allies.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ALLIES,
                    power_multiplier=0.0,
                    shield_grant=80,
                    icon_name="Shield",
                ),
                CombatCard(
                    id="artanis_solar_bombardment",
                    name="Orbital Solar Lance",
                    description="Beams concentrated stellar plasma disintegrating all foes.",
                    energy_cost=2,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.5,
                    icon_name="Sun",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.SELF_SHIELD_DEPLETED, card_id="artanis_shield_overcharge"),
                GambitRule(priority=2, condition=GambitCondition.ENEMY_COUNT_OVER_1, card_id="artanis_solar_bombardment"),
                GambitRule(priority=3, condition=GambitCondition.ALWAYS, card_id="artanis_twin_blades"),
            ],
            avatar_color="#eab308",
            avatar_icon="Swords",
        ),
        Champion(
            id="tmpl_protoss_tassadar",
            template_id="tmpl_protoss_tassadar",
            name="Executor Tassadar",
            title="Twilight Archon",
            faction=Faction.PROTOSS,
            role=Role.PSIONIC,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=320, max_hp=320, shields=240, max_shields=240, attack=56, defense=28, speed=106, crit_rate=0.20, crit_damage=1.70),
            cards=[
                CombatCard(
                    id="tassadar_psi_storm",
                    name="Psionic Storm",
                    description="Summons an electromagnetic maelstrom engulfing the entire battlefield.",
                    energy_cost=2,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.55,
                    icon_name="CloudLightning",
                ),
                CombatCard(
                    id="tassadar_plasma_surge",
                    name="Plasma Surge",
                    description="Direct energy bolt penetrating target shields.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.6,
                    icon_name="Zap",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_COUNT_OVER_1, card_id="tassadar_psi_storm"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="tassadar_plasma_surge"),
            ],
            avatar_color="#38bdf8",
            avatar_icon="CloudLightning",
        ),
        Champion(
            id="tmpl_protoss_zeratul",
            template_id="tmpl_protoss_zeratul",
            name="Prelate Zeratul",
            title="Dark Templar",
            faction=Faction.PROTOSS,
            role=Role.ASSAULT,
            rarity=Rarity.EPIC,
            level=1,
            experience=0,
            base_stats=Stats(hp=300, max_hp=300, shields=150, max_shields=150, attack=62, defense=24, speed=118, crit_rate=0.28, crit_damage=1.90),
            cards=[
                CombatCard(
                    id="zeratul_void_slash",
                    name="Warp Blade Ambush",
                    description="Strikes unseen from the Void dealing immense critical damage.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.95,
                    icon_name="Slash",
                ),
                CombatCard(
                    id="zeratul_shadow_cleave",
                    name="Shadow Cleave",
                    description="Sweeping warp slice through adjacent hostiles.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ENEMIES,
                    power_multiplier=1.25,
                    icon_name="Sparkles",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.ENEMY_IS_ELITE, card_id="zeratul_void_slash"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="zeratul_shadow_cleave"),
            ],
            avatar_color="#14b8a6",
            avatar_icon="Slash",
        ),
        Champion(
            id="tmpl_protoss_karax",
            template_id="tmpl_protoss_karax",
            name="Phase-Smith Karax",
            title="Pylon Architect",
            faction=Faction.PROTOSS,
            role=Role.SUPPORT,
            rarity=Rarity.RARE,
            level=1,
            experience=0,
            base_stats=Stats(hp=350, max_hp=350, shields=180, max_shields=180, attack=30, defense=38, speed=98, crit_rate=0.10, crit_damage=1.35),
            cards=[
                CombatCard(
                    id="karax_guardian_shield",
                    name="Guardian Barrier",
                    description="Deploys energy dome shielding all allies from incoming fire.",
                    energy_cost=1,
                    target_type=TargetType.ALL_ALLIES,
                    power_multiplier=0.0,
                    shield_grant=70,
                    icon_name="Shield",
                ),
                CombatCard(
                    id="karax_chrono_beam",
                    name="Chrono Beam",
                    description="Fires focused tachyon beam at hostile core.",
                    energy_cost=1,
                    target_type=TargetType.SINGLE_ENEMY,
                    power_multiplier=1.2,
                    icon_name="Radio",
                ),
            ],
            gambits=[
                GambitRule(priority=1, condition=GambitCondition.SELF_SHIELD_DEPLETED, card_id="karax_guardian_shield"),
                GambitRule(priority=2, condition=GambitCondition.ALWAYS, card_id="karax_chrono_beam"),
            ],
            avatar_color="#eab308",
            avatar_icon="Shield",
        ),
    ]


_BROODLINGS = {"name": "Broodling Swarm", "count": 6, "unit_hp": 32, "unit_attack": 6, "defense": 6}


def get_char_difficulty_enemies() -> List[Dict[str, Any]]:
    """Char threats unlocked at difficulty 4, 8 and 10. Card dicts follow CombatCard.from_dict."""
    return [
        # ── Tier 4 ──
        {
            "name": "Baneling Swarm", "role": "troop", "min_tier": 4,
            "hp": 220, "attack": 52, "defense": 8, "speed": 120,
        },
        {
            "name": "Swarm Queen", "role": "elite", "min_tier": 4,
            "hp": 560, "attack": 40, "defense": 32, "speed": 100,
            "summons": {"enemy_broodlings": _BROODLINGS},
            "cards": [
                {"id": "queen_transfusion", "name": "Transfusion", "target_type": "lowest_hp_ally",
                 "description": "Mends the most wounded hostile in nearby lanes.",
                 "power_multiplier": 0.0, "heal_multiplier": 2.4, "cooldown_turns": 3,
                 "lane_scope": "adjacent_lanes", "icon_name": "Heart"},
                {"id": "queen_spawn_broodlings", "name": "Spawn Broodlings", "target_type": "self",
                 "description": "Births a Broodling swarm into her lane.",
                 "power_multiplier": 0.0, "cooldown_turns": 4, "summon_troop_id": "enemy_broodlings",
                 "icon_name": "Bug"},
            ],
        },
        # ── Tier 8 ──
        {
            "name": "Ultralisk Vanguard", "role": "troop", "min_tier": 8,
            "hp": 560, "attack": 46, "defense": 48, "speed": 80,
        },
        {
            "name": "Lurker Ambusher", "role": "elite", "min_tier": 8,
            "hp": 520, "attack": 58, "defense": 30, "speed": 92,
            "cards": [
                {"id": "lurker_spine_barrage", "name": "Spine Barrage", "target_type": "all_enemies",
                 "description": "Subterranean spines rake every enemy in its lane.",
                 "power_multiplier": 0.75, "cooldown_turns": 2, "lane_scope": "same_lane", "icon_name": "Swords"},
                {"id": "lurker_burrowed_ambush", "name": "Burrowed Ambush", "target_type": "single_enemy",
                 "description": "Erupts under the most valuable target in nearby lanes.",
                 "power_multiplier": 1.7, "cooldown_turns": 3, "lane_scope": "adjacent_lanes", "icon_name": "Crosshair"},
            ],
        },
        # ── Tier 10 ──
        {
            "name": "Brood Lord", "role": "elite", "min_tier": 10,
            "hp": 620, "attack": 56, "defense": 30, "speed": 86,
            "summons": {"enemy_broodlings": _BROODLINGS},
            "cards": [
                {"id": "broodlord_broodling_rain", "name": "Broodling Rain", "target_type": "all_enemies",
                 "description": "Bombards nearby lanes and drops a fresh Broodling swarm.",
                 "power_multiplier": 0.5, "cooldown_turns": 3, "lane_scope": "adjacent_lanes",
                 "summon_troop_id": "enemy_broodlings", "icon_name": "CloudRain"},
            ],
        },
        {
            "name": "Primal Tyrant", "role": "boss", "min_tier": 10,
            "hp": 720, "attack": 62, "defense": 46, "speed": 96,
            "summons": {"enemy_broodlings": _BROODLINGS},
            "cards": [
                {"id": "tyrant_magma_eruption", "name": "Magma Eruption", "target_type": "all_enemies",
                 "description": "Char itself erupts: heavy damage across every lane.",
                 "power_multiplier": 0.8, "cooldown_turns": 2, "lane_scope": "all_lanes", "icon_name": "Flame"},
                {"id": "tyrant_primal_regeneration", "name": "Primal Regeneration", "target_type": "self",
                 "description": "Regrows carapace: large shield and heals the most wounded hostile.",
                 "power_multiplier": 0.0, "heal_multiplier": 3.0, "shield_grant": 220, "cooldown_turns": 4,
                 "icon_name": "Heart"},
                {"id": "tyrant_brood_call", "name": "Brood Call", "target_type": "self",
                 "description": "Calls a Broodling swarm to its lane.",
                 "power_multiplier": 0.0, "cooldown_turns": 3, "summon_troop_id": "enemy_broodlings",
                 "icon_name": "Bug"},
            ],
        },
    ]


def get_seed_biomes() -> List[Biome]:
    biomes = _seed_biomes()
    for biome in biomes:
        for proto in biome.enemy_pool + biome.difficulty_enemies:
            _decorate_enemy(proto)
    return biomes


def _decorate_enemy(proto: Dict[str, Any]) -> None:
    """Attach catalog passives and ability effects to an enemy prototype."""
    if proto.get("name") in ENEMY_PASSIVES and "passive" not in proto:
        proto["passive"] = ENEMY_PASSIVES[proto["name"]]
    for card in proto.get("cards", []):
        if card.get("id") in ENEMY_ABILITY_EFFECTS and "effects" not in card:
            card["effects"] = ENEMY_ABILITY_EFFECTS[card["id"]]


def _seed_biomes() -> List[Biome]:
    return [
        Biome(
            id="biome_char",
            name="Char: Molten Ashfields",
            description="Volcanic planet overrun by frenzied Swarm hives and molten magma rivers.",
            hazard_name="Thermal Overheat",
            hazard_description="Extreme heat reduces team defense by 10%.",
            recommended_power=800,
            allowed_artifact_sets=[ArtifactSetType.OFFENSE, ArtifactSetType.LIFESTEAL],
            color="#ef4444",
            bg_gradient="from-red-950 via-zinc-900 to-black",
            icon_name="Flame",
            enemy_pool=[
                {"name": "Zergling Brood", "hp": 180, "max_hp": 180, "shields": 0, "attack": 28, "defense": 12, "speed": 115, "is_elite": False, "is_alive": True},
                {"name": "Roach Spitter", "hp": 290, "max_hp": 290, "shields": 0, "attack": 32, "defense": 26, "speed": 85, "is_elite": False, "is_alive": True},
                {"name": "Primal Ravager", "hp": 480, "max_hp": 480, "shields": 0, "attack": 46, "defense": 35, "speed": 95, "is_elite": True, "is_alive": True},
            ],
            max_difficulty=10,
            difficulty_enemies=get_char_difficulty_enemies(),
        ),
        Biome(
            id="biome_aiur",
            name="Aiur: Khaydarin Ruins",
            description="Ancient Protoss homeworld overgrown with crystal jungles and autonomous guardian pylons.",
            hazard_name="Psionic Resonance",
            hazard_description="Shielded enemies regenerate partial shields between rooms.",
            recommended_power=1100,
            allowed_artifact_sets=[ArtifactSetType.SHIELD, ArtifactSetType.CRIT],
            color="#38bdf8",
            bg_gradient="from-cyan-950 via-zinc-900 to-black",
            icon_name="Sparkles",
            enemy_pool=[
                {"name": "Zealot Automaton", "hp": 240, "max_hp": 240, "shields": 120, "max_shields": 120, "attack": 34, "defense": 24, "speed": 105, "is_elite": False, "is_alive": True},
                {"name": "Stalker Strider", "hp": 260, "max_hp": 260, "shields": 150, "max_shields": 150, "attack": 38, "defense": 20, "speed": 112, "is_elite": False, "is_alive": True},
                {"name": "Immortal Sentinel", "hp": 450, "max_hp": 450, "shields": 280, "max_shields": 280, "attack": 52, "defense": 42, "speed": 82, "is_elite": True, "is_alive": True},
            ]
        ),
        Biome(
            id="biome_mar_sara",
            name="Mar Sara: Badland Outposts",
            description="Dust-swept frontier wasteland packed with renegade mercenaries, scrap mechs, and raiders.",
            hazard_name="Scrap Ambush",
            hazard_description="Mercenaries initiate with high initial speed burst.",
            recommended_power=650,
            allowed_artifact_sets=[ArtifactSetType.SPEED, ArtifactSetType.OFFENSE],
            color="#f59e0b",
            bg_gradient="from-amber-950 via-zinc-900 to-black",
            icon_name="Compass",
            enemy_pool=[
                {"name": "Raider Marine", "hp": 190, "max_hp": 190, "shields": 40, "max_shields": 40, "attack": 26, "defense": 18, "speed": 100, "is_elite": False, "is_alive": True},
                {"name": "Firebat Pyromaniac", "hp": 280, "max_hp": 280, "shields": 50, "max_shields": 50, "attack": 30, "defense": 32, "speed": 88, "is_elite": False, "is_alive": True},
                {"name": "Scrap Goliath", "hp": 420, "max_hp": 420, "shields": 80, "max_shields": 80, "attack": 44, "defense": 36, "speed": 92, "is_elite": True, "is_alive": True},
            ]
        ),
        Biome(
            id="biome_void",
            name="Derelict Station: Void Sector",
            description="Deep space laboratory contaminated by void anomalies and cyber-mutants.",
            hazard_name="Null-Atmosphere",
            hazard_description="Void entities deal bonus critical strikes.",
            recommended_power=1500,
            allowed_artifact_sets=[ArtifactSetType.LIFESTEAL, ArtifactSetType.CRIT, ArtifactSetType.SHIELD],
            color="#a855f7",
            bg_gradient="from-purple-950 via-zinc-900 to-black",
            icon_name="Radio",
            enemy_pool=[
                {"name": "Void Shade", "hp": 270, "max_hp": 270, "shields": 100, "max_shields": 100, "attack": 45, "defense": 22, "speed": 118, "is_elite": False, "is_alive": True},
                {"name": "Corrupted Hybrid", "hp": 580, "max_hp": 580, "shields": 200, "max_shields": 200, "attack": 62, "defense": 45, "speed": 102, "is_elite": True, "is_alive": True},
            ]
        ),
    ]


def get_seed_starting_artifacts() -> List[Artifact]:
    return [
        Artifact(
            id="art_seed_weapon_1",
            template_id="tmpl_weapon",
            name="Rare C-14 Gauss Penetrator",
            slot=ArtifactSlot.WEAPON,
            rarity=Rarity.RARE,
            set_type=ArtifactSetType.OFFENSE,
            level=3,
            main_stat_name="attack",
            main_stat_value=32,
            sub_stats=[{"stat": "crit_rate", "value": 0.05}],
            equipped_to="user_champ_raynor",
        ),
        Artifact(
            id="art_seed_armor_1",
            template_id="tmpl_armor",
            name="Epic Neosteel Heavy Plating",
            slot=ArtifactSlot.ARMOR,
            rarity=Rarity.EPIC,
            set_type=ArtifactSetType.SHIELD,
            level=4,
            main_stat_name="defense",
            main_stat_value=38,
            sub_stats=[{"stat": "hp", "value": 60}, {"stat": "defense", "value": 8}],
            equipped_to="user_champ_artanis",
        ),
        Artifact(
            id="art_seed_boots_1",
            template_id="tmpl_boots",
            name="Rare Hyperion Thrusters",
            slot=ArtifactSlot.BOOTS,
            rarity=Rarity.RARE,
            set_type=ArtifactSetType.SPEED,
            level=2,
            main_stat_name="speed",
            main_stat_value=14,
            sub_stats=[{"stat": "crit_damage", "value": 0.08}],
            equipped_to=None,
        ),
        Artifact(
            id="art_seed_core_1",
            template_id="tmpl_core",
            name="Legendary Khaydarin Reactor",
            slot=ArtifactSlot.CORE,
            rarity=Rarity.LEGENDARY,
            set_type=ArtifactSetType.CRIT,
            level=6,
            main_stat_name="shields",
            main_stat_value=160,
            sub_stats=[{"stat": "crit_rate", "value": 0.08}, {"stat": "speed", "value": 6}, {"stat": "attack", "value": 14}],
            equipped_to=None,
        ),
    ]


# ══════════════════════════════════════════════════════════════════════════════
# LANE BATTLE CATALOG (Active Expedition runs)
# ══════════════════════════════════════════════════════════════════════════════
from src.domain.value_objects.enums import LaneScope  # noqa: E402
from src.domain.value_objects.troop import TroopTemplate  # noqa: E402

TROOPS_PER_HERO = 2


def get_seed_troop_templates() -> List[TroopTemplate]:
    return [
        # Terran
        TroopTemplate("troop_marine", "Marine Squad", Faction.TERRAN.value, count=6, unit_hp=35, unit_attack=6, defense=12,
                      description="Reliable gauss riflemen. Balanced pack.", icon_name="Crosshair"),
        TroopTemplate("troop_marauder", "Marauder Team", Faction.TERRAN.value, count=4, unit_hp=70, unit_attack=9, defense=25,
                      description="Armored grenadiers. Hold the line.", icon_name="Shield"),
        # Zerg
        TroopTemplate("troop_zergling", "Zergling Swarm", Faction.ZERG.value, count=10, unit_hp=18, unit_attack=3, defense=6,
                      description="Many fragile bodies. Absorbs hits for the hero behind.", icon_name="Bug"),
        TroopTemplate("troop_hydralisk", "Hydralisk Brood", Faction.ZERG.value, count=5, unit_hp=40, unit_attack=8, defense=10,
                      description="Spine-launching damage dealers.", icon_name="Zap"),
        # Protoss
        TroopTemplate("troop_zealot", "Zealot Cohort", Faction.PROTOSS.value, count=4, unit_hp=75, unit_attack=10, defense=18,
                      description="Psi-blade warriors. Elite but few.", icon_name="Swords"),
        TroopTemplate("troop_stalker", "Stalker Wing", Faction.PROTOSS.value, count=3, unit_hp=90, unit_attack=12, defense=20,
                      description="Blink-capable walkers with heavy shots.", icon_name="Radio"),
    ]


def get_seed_ability_lane_scopes() -> Dict[str, LaneScope]:
    """How far each champion ability reaches on the lane board (default: same lane)."""
    return {
        "raynor_hyperion_barrage": LaneScope.ALL_LANES,
        "nova_snipe": LaneScope.ANY_LANE,
        "nova_emp": LaneScope.ADJACENT_LANES,
        "medic_nanite_heal": LaneScope.ADJACENT_LANES,
        "tank_siege_blast": LaneScope.ADJACENT_LANES,
        "kerrigan_psionic_shift": LaneScope.ADJACENT_LANES,
        "kerrigan_crushing_grip": LaneScope.ANY_LANE,
        "dehaka_drag": LaneScope.ANY_LANE,
        "artanis_shield_overcharge": LaneScope.ADJACENT_LANES,
        "artanis_solar_bombardment": LaneScope.ALL_LANES,
        "tassadar_psi_storm": LaneScope.ANY_LANE,
        "zeratul_void_slash": LaneScope.ANY_LANE,
        "karax_guardian_shield": LaneScope.ALL_LANES,
        "karax_chrono_beam": LaneScope.ANY_LANE,
    }


def get_seed_summon_abilities() -> Dict[str, List[CombatCard]]:
    """Extra lane-battle abilities granted per champion template: troop summons."""
    def summon(card_id: str, name: str, desc: str, troop_id: str, scope: LaneScope, quote: str) -> CombatCard:
        return CombatCard(
            id=card_id, name=name, description=desc, energy_cost=2,
            target_type=TargetType.SELF, power_multiplier=0.0, cooldown_turns=3,
            icon_name="Users", flavor_quote=quote, lane_scope=scope, summon_troop_id=troop_id,
        )

    return {
        "tmpl_terran_raynor": [summon("raynor_drop_pods", "Drop-Pod Marines", "Call a fresh Marine Squad into any lane.",
                                      "troop_marine", LaneScope.ANY_LANE, "Boys, we got company!")],
        "tmpl_terran_tank": [summon("duke_marauder_drop", "Marauder Detachment", "Deploy a Marauder Team in this lane.",
                                    "troop_marauder", LaneScope.SAME_LANE, "Hold position!")],
        "tmpl_zerg_kerrigan": [summon("kerrigan_spawn_brood", "Spawn Brood", "Spawn a Zergling Swarm in any lane.",
                                      "troop_zergling", LaneScope.ANY_LANE, "The Swarm answers.")],
        "tmpl_zerg_dehaka": [summon("dehaka_primal_pack", "Primal Pack", "Call a Hydralisk Brood into this lane.",
                                    "troop_hydralisk", LaneScope.SAME_LANE, "Pack hunts together.")],
        "tmpl_protoss_karax": [summon("karax_warp_in", "Warp-In Zealots", "Warp a Zealot Cohort into any lane.",
                                      "troop_zealot", LaneScope.ANY_LANE, "Matrix online.")],
        "tmpl_protoss_artanis": [summon("artanis_stalker_warp", "Stalker Warp", "Warp a Stalker Wing into this lane.",
                                        "troop_stalker", LaneScope.SAME_LANE, "En Taro Tassadar!")],
    }


# ── Hero kits: passives & ability status effects ─────────────────────────────
# Card effects / passives are catalog data keyed by template or card id, so champions
# already stored in the database pick them up without a migration.

def _fx(type_: str, target: str = "hit", value: float = 0.0, turns: int = 2, chance: float = 1.0, count: int = 1) -> Dict[str, Any]:
    return {"type": type_, "target": target, "value": value, "turns": turns, "chance": chance, "count": count}


def get_seed_ability_effects() -> Dict[str, List[Dict[str, Any]]]:
    return {
        # Terran
        "raynor_penetrator": [_fx("DEF_DOWN", "hit", 0.30, 2, 0.75)],
        "raynor_inspire": [_fx("ATK_UP", "allies", 0.25, 2)],
        "nova_snipe": [_fx("STRIP", "hit", chance=0.9), _fx("MARKED", "hit", 0.25, 2, 0.8)],
        "nova_emp": [_fx("SPD_DOWN", "hit", 0.25, 2, 0.6)],
        "medic_nanite_heal": [_fx("CLEANSE", "ally", count=2), _fx("REGEN", "ally", 0.06, 2)],
        "medic_optical_flare": [_fx("ATK_DOWN", "hit", 0.25, 2, 0.8)],
        "tank_siege_blast": [_fx("DEF_DOWN", "hit", 0.25, 2, 0.5)],
        "tank_fortify": [_fx("DEF_UP", "self", 0.50, 2), _fx("IMMUNITY", "self", turns=2)],
        # Zerg
        "kerrigan_crushing_grip": [_fx("STUN", "hit", turns=1, chance=0.5)],
        "kerrigan_primal_leech": [_fx("STEAL", "hit", chance=0.85)],
        "ultra_kaiser_cleave": [_fx("DEF_DOWN", "hit", 0.20, 2, 0.4)],
        "ultra_burrow_charge": [_fx("STUN", "hit", turns=1, chance=0.35)],
        "dehaka_drag": [_fx("SPD_DOWN", "hit", 0.30, 2, 0.75)],
        "dehaka_consume": [_fx("ATK_UP", "self", 0.30, 2)],
        "hydra_grooved_spines": [_fx("POISON", "hit", 0.05, 2, 0.6)],
        # Protoss
        "artanis_shield_overcharge": [_fx("DEF_UP", "allies", 0.50, 2)],
        "artanis_solar_bombardment": [_fx("BURN", "hit", 0.05, 2, 0.5)],
        "tassadar_psi_storm": [_fx("BURN", "hit", 0.05, 2, 0.6)],
        "tassadar_plasma_surge": [_fx("STRIP", "hit", count=2, chance=0.8)],
        "zeratul_void_slash": [_fx("DEF_DOWN", "hit", 0.30, 2, 0.8)],
        "zeratul_shadow_cleave": [_fx("SPD_DOWN", "hit", 0.20, 2, 0.4)],
        "karax_guardian_shield": [_fx("IMMUNITY", "allies", turns=2), _fx("CLEANSE", "allies")],
        "karax_chrono_beam": [_fx("SPD_DOWN", "hit", 0.30, 2, 0.75)],
    }


def get_seed_hero_passives() -> Dict[str, Dict[str, Any]]:
    """One signature trait per hero template."""
    return {
        "tmpl_terran_raynor": {
            "id": "raynor_inspiring_leader", "name": "Raider Command", "kind": "LANE_AURA",
            "stat": "attack", "value": 0.12,
            "description": "Allies fighting in Raynor's lane deal +12% attack.",
        },
        "tmpl_terran_nova": {
            "id": "nova_ghost_protocol", "name": "Ghost Protocol", "kind": "DAMAGE_VS_DEBUFFED", "value": 0.25,
            "description": "Deals +25% damage to targets with at least one debuff.",
        },
        "tmpl_terran_medic": {
            "id": "medic_field_triage", "name": "Field Triage", "kind": "REGEN", "value": 0.04, "lane_wide": True,
            "description": "At the start of each of her turns, heals every ally in her lane for 4% max HP.",
        },
        "tmpl_terran_tank": {
            "id": "duke_entrenched", "name": "Entrenched", "kind": "STACK_ON_TURN_END",
            "stat": "defense", "value": 0.04, "max_stacks": 10,
            "description": "Gains +4% defense at the end of each of his turns (max 10 stacks).",
        },
        "tmpl_zerg_kerrigan": {
            "id": "kerrigan_swarm_queen", "name": "Queen of the Swarm", "kind": "PER_ALLY_TROOP",
            "stat": "attack", "value": 0.06,
            "description": "+6% attack for every allied troop pack alive across all lanes.",
        },
        "tmpl_zerg_ultralisk": {
            "id": "torrasque_regrowth", "name": "Chitin Regrowth", "kind": "REGEN", "value": 0.06,
            "description": "Regenerates 6% max HP at the start of each of its turns.",
        },
        "tmpl_zerg_dehaka": {
            "id": "dehaka_primal_rage", "name": "Primal Rage", "kind": "LOW_HP",
            "stat": "attack", "value": 0.40, "threshold": 0.5,
            "description": "+40% attack while below 50% HP.",
        },
        "tmpl_zerg_hydralisk": {
            "id": "hydra_toxic_glands", "name": "Toxic Glands", "kind": "ON_HIT_EFFECT",
            "effect": _fx("POISON", "hit", 0.04, 2, 0.3),
            "description": "Abilities have a 30% chance to poison targets hit (4% max HP per turn, 2 turns).",
        },
        "tmpl_protoss_artanis": {
            "id": "artanis_hierarch", "name": "Hierarch's Resolve", "kind": "LANE_AURA",
            "stat": "defense", "value": 0.20,
            "description": "Allies fighting in Artanis' lane gain +20% defense.",
        },
        "tmpl_protoss_tassadar": {
            "id": "tassadar_khaydarin", "name": "Khaydarin Focus", "kind": "SHIELD_REGEN", "value": 0.10,
            "description": "Restores 10% max shields at the start of each of his turns.",
        },
        "tmpl_protoss_zeratul": {
            "id": "zeratul_void_assassin", "name": "Void Assassin", "kind": "ON_KILL_METER", "value": 50,
            "description": "Killing a unit fills 50% of his turn meter.",
        },
        "tmpl_protoss_karax": {
            "id": "karax_chrono_boost", "name": "Chrono Boost", "kind": "LANE_AURA",
            "stat": "speed", "value": 0.15,
            "description": "Allies fighting in Karax' lane gain +15% speed.",
        },
    }


# Passives for enemy elites / bosses, keyed by enemy name.
ENEMY_PASSIVES: Dict[str, Dict[str, Any]] = {
    "Primal Ravager": {
        "id": "ravager_frenzy", "name": "Frenzy", "kind": "STACK_ON_TURN_END",
        "stat": "attack", "value": 0.05, "max_stacks": 6,
        "description": "+5% attack at the end of each of its turns (max 6).",
    },
    "Immortal Sentinel": {
        "id": "immortal_barrier", "name": "Hardened Barrier", "kind": "SHIELD_REGEN", "value": 0.12,
        "description": "Restores 12% max shields every turn.",
    },
    "Scrap Goliath": {
        "id": "goliath_shred", "name": "Shredder Rounds", "kind": "ON_HIT_EFFECT",
        "effect": _fx("DEF_DOWN", "hit", 0.20, 2, 0.35),
        "description": "Attacks have a 35% chance to reduce defense by 20% for 2 turns.",
    },
    "Corrupted Hybrid": {
        "id": "hybrid_predator", "name": "Void Predator", "kind": "DAMAGE_VS_DEBUFFED", "value": 0.30,
        "description": "+30% damage against debuffed targets.",
    },
    "Swarm Queen": {
        "id": "queen_mend", "name": "Creep Tumor", "kind": "REGEN", "value": 0.04, "lane_wide": True,
        "description": "Heals every hostile in her lane for 4% max HP each turn.",
    },
    "Lurker Ambusher": {
        "id": "lurker_hunter", "name": "Ambush Predator", "kind": "DAMAGE_VS_DEBUFFED", "value": 0.30,
        "description": "+30% damage against debuffed targets.",
    },
    "Brood Lord": {
        "id": "broodlord_swarm", "name": "Swarm Cloud", "kind": "ON_HIT_EFFECT",
        "effect": _fx("SPD_DOWN", "hit", 0.20, 2, 0.4),
        "description": "Attacks have a 40% chance to slow by 20% for 2 turns.",
    },
    "Primal Tyrant": {
        "id": "tyrant_apex", "name": "Apex Fury", "kind": "LOW_HP", "stat": "attack", "value": 0.50, "threshold": 0.5,
        "description": "+50% attack below 50% HP.",
    },
}

# Status effects on enemy abilities, keyed by card id.
ENEMY_ABILITY_EFFECTS: Dict[str, List[Dict[str, Any]]] = {
    "boss_apex_roar": [_fx("ATK_DOWN", "hit", 0.20, 2, 0.5)],
    "queen_transfusion": [_fx("CLEANSE", "ally", count=2)],
    "lurker_spine_barrage": [_fx("POISON", "hit", 0.05, 2, 0.5)],
    "lurker_burrowed_ambush": [_fx("DEF_DOWN", "hit", 0.30, 2, 0.7)],
    "broodlord_broodling_rain": [_fx("SPD_DOWN", "hit", 0.20, 2, 0.4)],
    "tyrant_magma_eruption": [_fx("BURN", "hit", 0.04, 2, 0.6)],
    "tyrant_primal_regeneration": [_fx("ATK_UP", "self", 0.30, 2), _fx("CLEANSE", "self", count=3)],
}
