"""
Warp Beacon: heroes are warpcopied (3D-printed) from a blueprint plus print materials.
Blueprints and materials are found on expeditions (archive nodes, boss victories).
"""
import random
import uuid
from typing import Any, Dict, Iterable, List, Optional, Set

from src.domain.entities.champion import Champion
from src.domain.entities.hero_archive import HeroArchive

PRINT_COST = 100                 # materials consumed by one warpcopy
ARCHIVE_BLUEPRINT_CHANCE = 0.40  # archive node: chance to recover a new blueprint
BOSS_BLUEPRINT_CHANCE = 0.30     # boss victory: chance to recover a new blueprint


class WarpForgeService:
    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    # ── Warpcopy ────────────────────────────────────────────────────────────
    @staticmethod
    def warpcopy(archive: HeroArchive, template: Champion) -> Champion:
        tid = template.template_id
        if tid not in archive.blueprints:
            raise ValueError(f"No blueprint for {template.name} — recover it on an expedition first.")
        have = archive.materials_for(tid)
        if have < PRINT_COST:
            raise ValueError(f"{template.name} needs {PRINT_COST} print materials ({have}/{PRINT_COST}).")
        archive.materials[tid] = have - PRINT_COST
        return Champion(
            id=f"champ_{uuid.uuid4().hex[:8]}",
            template_id=tid,
            name=template.name,
            title=template.title,
            faction=template.faction,
            role=template.role,
            rarity=template.rarity,
            level=1,
            experience=0,
            base_stats=template.base_stats,
            cards=template.cards,
            gambits=template.gambits,
            equipped_artifact_ids={},
            avatar_color=template.avatar_color,
            avatar_icon=template.avatar_icon,
        )

    # ── Expedition loot ─────────────────────────────────────────────────────
    def _materials(self, pool: List[str], known: Set[str], drops: int, low: int, high: int) -> Dict[str, int]:
        """Materials mostly for heroes whose blueprint is known (so they can actually be printed)."""
        out: Dict[str, int] = {}
        known_pool = [t for t in pool if t in known]
        for _ in range(drops):
            source = known_pool if known_pool and self.rng.random() < 0.7 else pool
            tid = self.rng.choice(source)
            out[tid] = out.get(tid, 0) + self.rng.randint(low, high)
        return out

    def _blueprint(self, pool: List[str], known: Set[str], chance: float) -> List[str]:
        missing = [t for t in pool if t not in known]
        if missing and self.rng.random() < chance:
            return [self.rng.choice(missing)]
        return []

    def archive_loot(self, pool: Iterable[str], known: Iterable[str]) -> Dict[str, Any]:
        """Derelict warp archive node: maybe a blueprint, always some print materials."""
        pool, known = list(pool), set(known)
        if not pool:
            return {}
        blueprints = self._blueprint(pool, known, ARCHIVE_BLUEPRINT_CHANCE)
        return {
            "blueprints": blueprints,
            "hero_materials": self._materials(pool, known | set(blueprints), self.rng.randint(1, 2), 15, 30),
        }

    def boss_loot(self, pool: Iterable[str], known: Iterable[str]) -> Dict[str, Any]:
        """Boss victory: a bigger haul of print materials and a shot at a blueprint."""
        pool, known = list(pool), set(known)
        if not pool:
            return {}
        blueprints = self._blueprint(pool, known, BOSS_BLUEPRINT_CHANCE)
        return {
            "blueprints": blueprints,
            "hero_materials": self._materials(pool, known | set(blueprints), self.rng.randint(1, 3), 20, 40),
        }
