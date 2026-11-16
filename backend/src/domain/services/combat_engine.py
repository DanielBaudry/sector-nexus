import random
import time
from typing import List, Dict, Any, Optional, Tuple
from src.domain.entities.expedition import ActiveExpedition
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import TargetType
from src.domain.services.gambit_evaluator import GambitEvaluator
from src.domain.value_objects.gambit import GambitRule


class CombatEngine:
    @staticmethod
    def initialize_turn_meters(expedition: ActiveExpedition) -> None:
        for ally in expedition.allies:
            ally["turn_meter"] = ally.get("turn_meter", random.randint(10, 40))
        for enemy in expedition.enemies:
            enemy["turn_meter"] = enemy.get("turn_meter", random.randint(10, 35))

    @staticmethod
    def step_initiative(expedition: ActiveExpedition) -> None:
        """
        Increases turn meter of living combatants by speed until one reaches 100.
        If an ally reaches 100, sets current_turn_entity to ALLY and draws cards.
        If an enemy reaches 100, executes enemy turn automatically.
        """
        living_allies = [a for a in expedition.allies if a.get("is_alive", True)]
        living_enemies = [e for e in expedition.enemies if e.get("is_alive", True)]

        if not living_allies:
            expedition.status = "DEFEAT"
            expedition.combat_log.append("❌ All strike team operatives neutralized. Expedition failed.")
            return

        if not living_enemies:
            # Check if more rooms exist
            if expedition.room_index + 1 < expedition.total_rooms:
                expedition.room_index += 1
                expedition.combat_log.append(f"⏩ Sector cleared! Advancing to Room {expedition.room_index + 1}/{expedition.total_rooms}...")
                # Room cleared rewards
                expedition.accumulated_rewards["credits"] += random.randint(150, 400)
                expedition.accumulated_rewards["experience"] += random.randint(60, 150)
                return
            else:
                expedition.status = "VICTORY"
                expedition.combat_log.append("🏆 Objective secured! All hostiles eliminated. Victory!")
                expedition.accumulated_rewards["credits"] += random.randint(1000, 2500)
                expedition.accumulated_rewards["crystals"] += random.randint(30, 80)
                expedition.accumulated_rewards["experience"] += random.randint(300, 600)
                return

        # Loop until someone reaches 100
        max_safety_iterations = 200
        iteration = 0
        while iteration < max_safety_iterations:
            iteration += 1

            # Check if anyone is ready (>= 100)
            ready_allies = [a for a in living_allies if a.get("turn_meter", 0) >= 100]
            ready_enemies = [e for e in living_enemies if e.get("turn_meter", 0) >= 100]

            if ready_allies:
                # Pick ally with highest meter
                ready_allies.sort(key=lambda x: x.get("turn_meter", 0), reverse=True)
                active_ally = ready_allies[0]
                expedition.current_turn_entity_type = "ALLY"
                expedition.current_turn_entity_id = active_ally["id"]
                expedition.turn_started_at = time.time()

                # Draw 3 tactical cards from ally's available cards
                cards = active_ally.get("cards", [])
                if len(cards) <= 3:
                    expedition.drawn_cards = cards
                else:
                    expedition.drawn_cards = random.sample(cards, 3)

                expedition.combat_log.append(
                    f"⚡ {active_ally['name']} initiative ready! 7s countdown active. Choose tactical card."
                )
                return

            if ready_enemies:
                ready_enemies.sort(key=lambda x: x.get("turn_meter", 0), reverse=True)
                active_enemy = ready_enemies[0]
                CombatEngine._execute_enemy_turn(expedition, active_enemy)
                # Check if ally team died
                living_allies = [a for a in expedition.allies if a.get("is_alive", True)]
                if not living_allies:
                    expedition.status = "DEFEAT"
                    expedition.combat_log.append("❌ All strike team operatives neutralized. Expedition failed.")
                    return
                continue

            # Advance meters by speed
            for a in living_allies:
                a["turn_meter"] = a.get("turn_meter", 0) + max(5, int(a.get("speed", 100) * 0.15))
            for e in living_enemies:
                e["turn_meter"] = e.get("turn_meter", 0) + max(5, int(e.get("speed", 90) * 0.15))

    @staticmethod
    def execute_ally_card(
        expedition: ActiveExpedition,
        card_id: Optional[str] = None,
        force_timeout_gambit: bool = False
    ) -> None:
        """
        Executes a card on the active ally's turn.
        If card_id is None or timeout occurred, falls back to the champion's Gambit behavior!
        """
        if expedition.current_turn_entity_type != "ALLY" or not expedition.current_turn_entity_id:
            return

        actor = next((a for a in expedition.allies if a["id"] == expedition.current_turn_entity_id), None)
        if not actor or not actor.get("is_alive", True):
            expedition.current_turn_entity_type = None
            expedition.current_turn_entity_id = None
            return

        available_card_dicts = actor.get("cards", [])
        available_cards = [CombatCard.from_dict(c) for c in available_card_dicts]

        card_to_cast: Optional[CombatCard] = None

        if not force_timeout_gambit and card_id:
            card_to_cast = next((c for c in available_cards if c.id == card_id), None)

        if not card_to_cast:
            # Fallback to configured AI Gambits
            gambit_rules = [GambitRule.from_dict(g) for g in actor.get("gambits", [])]
            card_to_cast = GambitEvaluator.evaluate(
                gambits=gambit_rules,
                actor=actor,
                allies=expedition.allies,
                enemies=expedition.enemies,
                available_cards=available_cards,
            )
            if force_timeout_gambit:
                expedition.combat_log.append(
                    f"⏱️ Decision window expired! Auto-AI Gambit triggered for {actor['name']}: {card_to_cast.name if card_to_cast else 'Standard Fire'}."
                )

        if not card_to_cast:
            card_to_cast = CombatCard(
                id="basic_attack",
                name="Standard Fire",
                description="Fire basic standard weapon.",
                energy_cost=0,
                target_type=TargetType.SINGLE_ENEMY,
                power_multiplier=1.0,
            )

        # Apply Card Effects
        living_enemies = [e for e in expedition.enemies if e.get("is_alive", True)]
        living_allies = [a for a in expedition.allies if a.get("is_alive", True)]

        actor_attack = actor.get("attack", 25)
        crit_rate = actor.get("crit_rate", 0.15)
        crit_mult = actor.get("crit_damage", 1.50)

        # 1. Damage handling
        if card_to_cast.target_type == TargetType.ALL_ENEMIES:
            for enemy in living_enemies:
                CombatEngine._deal_damage(actor, enemy, card_to_cast.power_multiplier, crit_rate, crit_mult, expedition.combat_log)
        elif living_enemies:
            # Target selection: prioritize low HP or elite
            target_enemy = min(living_enemies, key=lambda e: e.get("hp", 1))
            CombatEngine._deal_damage(actor, target_enemy, card_to_cast.power_multiplier, crit_rate, crit_mult, expedition.combat_log)

        # 2. Shield grant
        if card_to_cast.shield_grant > 0:
            actor["shields"] = min(
                actor.get("max_shields", 100),
                actor.get("shields", 0) + card_to_cast.shield_grant
            )
            expedition.combat_log.append(f"🛡️ {actor['name']} generated +{card_to_cast.shield_grant} Shields!")

        # 3. Heal grant
        if card_to_cast.heal_multiplier > 0:
            heal_amount = int(actor_attack * card_to_cast.heal_multiplier)
            if card_to_cast.target_type == TargetType.ALL_ALLIES:
                for ally in living_allies:
                    ally["hp"] = min(ally.get("max_hp", 100), ally.get("hp", 0) + heal_amount)
                expedition.combat_log.append(f"💚 Squad restored +{heal_amount} HP across all allies.")
            else:
                lowest_ally = min(living_allies, key=lambda a: a.get("hp", 1) / max(1, a.get("max_hp", 1)))
                lowest_ally["hp"] = min(lowest_ally.get("max_hp", 100), lowest_ally.get("hp", 0) + heal_amount)
                expedition.combat_log.append(f"💚 {actor['name']} healed {lowest_ally['name']} for +{heal_amount} HP.")

        # Reset turn meter
        actor["turn_meter"] = 0
        expedition.current_turn_entity_type = None
        expedition.current_turn_entity_id = None
        expedition.drawn_cards = []

        # Advance combat
        CombatEngine.step_initiative(expedition)

    @staticmethod
    def _execute_enemy_turn(expedition: ActiveExpedition, enemy: Dict[str, Any]) -> None:
        living_allies = [a for a in expedition.allies if a.get("is_alive", True)]
        if not living_allies:
            return

        target_ally = random.choice(living_allies)
        enemy_atk = enemy.get("attack", 20)
        power_mult = 1.2 if enemy.get("is_elite") else 1.0

        CombatEngine._deal_damage(
            actor=enemy,
            target=target_ally,
            power_mult=power_mult,
            crit_rate=0.10,
            crit_mult=1.35,
            log=expedition.combat_log,
            is_enemy=True
        )
        enemy["turn_meter"] = 0

    @staticmethod
    def _deal_damage(
        actor: Dict[str, Any],
        target: Dict[str, Any],
        power_mult: float,
        crit_rate: float,
        crit_mult: float,
        log: List[str],
        is_enemy: bool = False
    ) -> None:
        raw_atk = actor.get("attack", 20) * power_mult
        is_crit = random.random() < crit_rate
        if is_crit:
            raw_atk *= crit_mult

        target_def = target.get("defense", 10)
        mitigation = 100.0 / (100.0 + target_def)
        final_damage = max(1, int(raw_atk * mitigation))

        target_shields = target.get("shields", 0)
        if target_shields > 0:
            if target_shields >= final_damage:
                target["shields"] -= final_damage
                absorbed = final_damage
                final_damage = 0
                crit_tag = " [CRITICAL]" if is_crit else ""
                log.append(f"🛡️ {actor['name']}{crit_tag} hit {target['name']}'s shields for {absorbed} dmg (absorbed).")
            else:
                final_damage -= target_shields
                target["shields"] = 0
                target["hp"] = max(0, target.get("hp", 0) - final_damage)
                crit_tag = " [CRITICAL]" if is_crit else ""
                log.append(f"💥 {actor['name']}{crit_tag} shattered {target['name']}'s shields and dealt {final_damage} hull damage!")
        else:
            target["hp"] = max(0, target.get("hp", 0) - final_damage)
            crit_tag = " [CRITICAL]" if is_crit else ""
            log.append(f"💥 {actor['name']}{crit_tag} struck {target['name']} for {final_damage} damage!")

        if target.get("hp", 0) <= 0:
            target["is_alive"] = False
            target["hp"] = 0
            log.append(f"💀 {target['name']} was defeated!")
