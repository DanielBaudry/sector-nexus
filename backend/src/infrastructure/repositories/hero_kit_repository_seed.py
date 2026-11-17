from typing import Dict, List, Optional

from src.domain.repositories.hero_kit_repository import IHeroKitRepository
from src.domain.value_objects.status_effect import EffectSpec, Passive
from src.infrastructure.database.seed_data import get_seed_ability_effects, get_seed_hero_passives


class HeroKitRepositorySeed(IHeroKitRepository):
    def get_passive(self, template_id: str) -> Optional[Passive]:
        data = get_seed_hero_passives().get(template_id)
        return Passive.from_dict(data) if data else None

    def get_ability_effects(self) -> Dict[str, List[EffectSpec]]:
        return {cid: [EffectSpec.from_dict(e) for e in specs] for cid, specs in get_seed_ability_effects().items()}
