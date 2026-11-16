from typing import List, Dict, Any, Tuple
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.services.gacha_service import GachaService
from src.domain.entities.champion import Champion


class SummonChampionsUseCase:
    def __init__(
        self,
        champion_repo: IChampionRepository,
        player_repo: IPlayerRepository
    ):
        self.champion_repo = champion_repo
        self.player_repo = player_repo

    def execute(self, banner_faction: str = "ALL", count: int = 1) -> Dict[str, Any]:
        player = self.player_repo.get_profile()

        cost_shards = count
        cost_crystals = count * 150

        # Check currency
        if player.warp_shards >= cost_shards:
            player.warp_shards -= cost_shards
        elif player.crystals >= cost_crystals:
            player.crystals -= cost_crystals
        else:
            raise ValueError(f"Insufficient Warp Shards ({player.warp_shards}/{cost_shards}) or Crystals ({player.crystals}/{cost_crystals}).")

        self.player_repo.save_profile(player)

        # Get champion templates
        templates = self.champion_repo.get_templates()
        summoned_champions: List[Champion] = []

        for _ in range(count):
            new_champ = GachaService.summon_champion(templates, banner_faction=banner_faction)
            saved = self.champion_repo.save(new_champ)
            summoned_champions.append(saved)

        return {
            "summoned": [c.to_dict() for c in summoned_champions],
            "player": player.to_dict(),
        }
