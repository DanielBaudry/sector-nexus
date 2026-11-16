import random
import time
from typing import Dict, Any, List
from src.domain.entities.expedition import BackgroundExpedition
from src.domain.entities.champion import Champion
from src.domain.entities.biome import Biome
from src.domain.services.gacha_service import GachaService
from src.domain.value_objects.enums import Rarity


class IdleExpeditionService:
    @staticmethod
    def calculate_squad_power(champions: List[Champion]) -> int:
        power = 0
        for champ in champions:
            power += (champ.base_stats.attack * 2) + champ.base_stats.defense + int(champ.base_stats.hp * 0.3)
            power += champ.level * 25
        return max(100, power)

    @staticmethod
    def preview_rewards(squad_power: int, biome: Biome, duration_seconds: int) -> Dict[str, Any]:
        # Duration scale: every 60 seconds generates baseline rewards
        scale = max(1.0, duration_seconds / 60.0)
        power_bonus = 1.0 + (squad_power / 2000.0)

        credits = int(180 * scale * power_bonus)
        crystals = int(random.randint(5, 12) * scale)
        xp = int(120 * scale * power_bonus)
        gear_drop_chance = min(0.95, 0.25 * scale)

        return {
            "estimated_credits": credits,
            "estimated_crystals": crystals,
            "estimated_xp": xp,
            "gear_drop_chance": round(gear_drop_chance, 2),
            "allowed_artifact_sets": [s.value if hasattr(s, "value") else str(s) for s in biome.allowed_artifact_sets],
        }

    @staticmethod
    def finalize_rewards(expedition: BackgroundExpedition, biome: Biome, squad_power: int) -> Dict[str, Any]:
        preview = expedition.reward_preview or IdleExpeditionService.preview_rewards(squad_power, biome, expedition.duration_seconds)
        earned_credits = preview.get("estimated_credits", 500)
        earned_crystals = preview.get("estimated_crystals", 15)
        earned_xp = preview.get("estimated_xp", 300)

        # Roll for artifact gear drops
        dropped_artifacts = []
        if random.random() <= preview.get("gear_drop_chance", 0.5):
            pref_set = random.choice(biome.allowed_artifact_sets).value if biome.allowed_artifact_sets else None
            rarity = Rarity.RARE if random.random() < 0.4 else Rarity.COMMON
            art = GachaService.generate_random_artifact(min_rarity=rarity, preferred_set=pref_set)
            dropped_artifacts.append(art)

        return {
            "credits": earned_credits,
            "crystals": earned_crystals,
            "experience": earned_xp,
            "artifacts": [a.to_dict() for a in dropped_artifacts],
            "raw_artifacts": dropped_artifacts,
        }
