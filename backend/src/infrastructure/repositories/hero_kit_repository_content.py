from typing import Dict, List, Optional

from src.domain.repositories.hero_kit_repository import IHeroKitRepository
from src.domain.value_objects.status_effect import EffectSpec, Passive
from src.infrastructure.content.library import get_library


class HeroKitRepositoryContent(IHeroKitRepository):
    """Hero passives and ability effects, read from content/heroes/*.json."""

    def get_passive(self, template_id: str) -> Optional[Passive]:
        return get_library().hero_passive(template_id)

    def get_ability_effects(self) -> Dict[str, List[EffectSpec]]:
        effects: Dict[str, List[EffectSpec]] = {}
        for hero in get_library().heroes.values():
            for ability in hero.abilities:
                if ability.effects:
                    effects[ability.id] = [EffectSpec.from_dict(e.model_dump(exclude={"schema_ref"})) for e in ability.effects]
        return effects
