import copy
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.status_effect import EffectSpec, Passive


class IHeroKitRepository(ABC):
    """Catalog of hero passives and ability status effects (keyed by template / card id)."""

    @abstractmethod
    def get_passive(self, template_id: str) -> Optional[Passive]:
        pass

    @abstractmethod
    def get_ability_effects(self) -> Dict[str, List[EffectSpec]]:
        pass

    def apply_to_cards(self, cards: List[CombatCard]) -> List[CombatCard]:
        """Copies of `cards` with catalog effects attached (stored cards keep working)."""
        effects = self.get_ability_effects()
        out = copy.deepcopy(cards)
        for card in out:
            if card.id in effects:
                card.effects = copy.deepcopy(effects[card.id])
        return out

    def kit_view(self, template_id: str, cards: List[CombatCard]) -> Dict[str, Any]:
        passive = self.get_passive(template_id)
        return {
            "passive": passive.to_dict() if passive else None,
            "cards": [c.to_dict() for c in self.apply_to_cards(cards)],
        }
