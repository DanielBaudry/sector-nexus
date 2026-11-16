from typing import List, Dict, Any, Optional
from src.domain.value_objects.gambit import GambitRule
from src.domain.value_objects.enums import GambitCondition
from src.domain.value_objects.card import CombatCard


class GambitEvaluator:
    @staticmethod
    def evaluate(
        gambits: List[GambitRule],
        actor: Dict[str, Any],
        allies: List[Dict[str, Any]],
        enemies: List[Dict[str, Any]],
        available_cards: List[CombatCard],
    ) -> Optional[CombatCard]:
        """
        Evaluates ordered gambits and returns the matching CombatCard.
        If no gambit matches or card not found, defaults to first available card or basic attack.
        """
        card_lookup = {c.id: c for c in available_cards}
        living_allies = [a for a in allies if a.get("is_alive", True)]
        living_enemies = [e for e in enemies if e.get("is_alive", True)]

        sorted_gambits = sorted(gambits, key=lambda g: g.priority)

        for rule in sorted_gambits:
            card = card_lookup.get(rule.card_id)
            if not card:
                continue

            cond = rule.condition
            if cond == GambitCondition.ALWAYS:
                return card

            elif cond == GambitCondition.ALLY_HP_UNDER_50:
                has_critical_ally = any(
                    (a.get("hp", 0) / max(1, a.get("max_hp", 1))) < 0.50
                    for a in living_allies
                )
                if has_critical_ally:
                    return card

            elif cond == GambitCondition.SELF_SHIELD_DEPLETED:
                if actor.get("shields", 0) <= 0 and actor.get("max_shields", 0) > 0:
                    return card

            elif cond == GambitCondition.ENEMY_IS_ELITE:
                has_elite = any(e.get("is_elite", False) or e.get("is_boss", False) for e in living_enemies)
                if has_elite:
                    return card

            elif cond == GambitCondition.ENEMY_COUNT_OVER_1:
                if len(living_enemies) > 1:
                    return card

            elif cond == GambitCondition.ENEMY_LOW_HP:
                has_low = any(
                    (e.get("hp", 0) / max(1, e.get("max_hp", 1))) < 0.30
                    for e in living_enemies
                )
                if has_low:
                    return card

        # Default fallback
        if available_cards:
            return available_cards[0]
        return None
