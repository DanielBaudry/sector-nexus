import random
import uuid
from typing import Any, Dict, List, Optional

from src.domain.entities.artifact import Artifact
from src.domain.entities.biome import Biome
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.enums import ArtifactSetType, NodeType, Rarity

# Rarity odds per node type (Common, Rare, Epic, Legendary)
_RARITY_ODDS = {
    NodeType.COMBAT: (0.45, 0.38, 0.14, 0.03),
    NodeType.CACHE: (0.45, 0.38, 0.14, 0.03),
    NodeType.ELITE: (0.20, 0.45, 0.28, 0.07),
    NodeType.BOSS: (0.00, 0.40, 0.42, 0.18),
}
_RARITIES = (Rarity.COMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY)

# (chance of at least one drop, min, max)
_DROP_COUNT = {
    NodeType.COMBAT: (0.70, 1, 1),
    NodeType.CACHE: (0.50, 1, 1),
    NodeType.ELITE: (1.00, 1, 2),
    NodeType.BOSS: (1.00, 2, 3),
}

# Champion XP capsules per node type (before biome / depth scaling)
_XP_RANGE = {
    NodeType.COMBAT: (150, 250),
    NodeType.CACHE: (50, 100),
    NodeType.ELITE: (300, 450),
    NodeType.BOSS: (700, 1000),
}


class LootService:
    """Rolls node rewards: credits/crystals are handled by encounters; this adds XP capsules and artifacts."""

    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    @staticmethod
    def biome_rank(biome: Biome) -> int:
        """Base artifact rank for a biome: easy planets drop 3*, the hardest 5*."""
        power = biome.recommended_power
        if power >= 1400:
            return 5
        if power >= 1000:
            return 4
        return 3

    def roll_rank(self, biome: Biome, node_type: NodeType, threat: int, difficulty: int = 1) -> int:
        diff = Difficulty(difficulty)
        rank = self.biome_rank(biome) + diff.rank_floor_bonus
        if self.rng.random() < diff.rank_up_chance:
            rank += 1
        if node_type == NodeType.BOSS or (node_type == NodeType.ELITE and self.rng.random() < 0.35):
            rank += 1
        if threat >= 4 and self.rng.random() < 0.25:
            rank += 1
        return max(1, min(6, rank))

    def roll_rarity(self, node_type: NodeType, difficulty: int = 1) -> Rarity:
        odds = Difficulty(difficulty).rarity_odds(_RARITY_ODDS.get(node_type, _RARITY_ODDS[NodeType.COMBAT]))
        roll, acc = self.rng.random(), 0.0
        for rarity, weight in zip(_RARITIES, odds):
            acc += weight
            if roll <= acc:
                return rarity
        return Rarity.RARE

    def roll_artifacts(self, biome: Biome, node_type: NodeType, threat: int, difficulty: int = 1) -> List[Artifact]:
        diff = Difficulty(difficulty)
        chance, lo, hi = _DROP_COUNT.get(node_type, (0.0, 0, 0))
        if hi == 0 or self.rng.random() > chance + diff.drop_chance_bonus:
            return []
        count = self.rng.randint(lo, hi) + (1 if self.rng.random() < diff.extra_drop_chance else 0)
        sets = list(biome.allowed_artifact_sets) or list(ArtifactSetType)
        return [
            Artifact.generate(
                artifact_id=f"art_{uuid.uuid4().hex[:8]}",
                rarity=self.roll_rarity(node_type, difficulty),
                rank=self.roll_rank(biome, node_type, threat, difficulty),
                set_type=self.rng.choice(sets),
                rng=self.rng,
            )
            for _ in range(count)
        ]

    def roll_champion_xp(self, biome: Biome, node_type: NodeType, threat: int, difficulty: int = 1) -> int:
        lo, hi = _XP_RANGE.get(node_type, (0, 0))
        scale = (biome.recommended_power / 800.0) * (1 + 0.1 * max(0, threat - 1)) * Difficulty(difficulty).reward_mult
        return int(self.rng.randint(lo, hi) * scale)

    def node_loot(self, biome: Biome, node_type: NodeType, threat: int, difficulty: int = 1) -> Dict[str, Any]:
        return {
            "champion_xp": self.roll_champion_xp(biome, node_type, threat, difficulty),
            "artifacts": [a.to_dict() for a in self.roll_artifacts(biome, node_type, threat, difficulty)],
        }
