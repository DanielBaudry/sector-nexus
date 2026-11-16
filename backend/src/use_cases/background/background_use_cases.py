import time
import uuid
from typing import List, Dict, Any
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.entities.expedition import BackgroundExpedition
from src.domain.services.idle_service import IdleExpeditionService


class DispatchBackgroundExpeditionUseCase:
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        squad_repo: ISquadRepository,
        champion_repo: IChampionRepository,
    ):
        self.expedition_repo = expedition_repo
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo

    def execute(self, biome_id: str, squad_id: str, duration_seconds: int = 60) -> Dict[str, Any]:
        biome = self.expedition_repo.get_biome_by_id(biome_id)
        if not biome:
            raise ValueError(f"Biome {biome_id} not found.")

        squad = self.squad_repo.get_by_id(squad_id)
        if not squad or not squad.champion_ids:
            raise ValueError("Squad not found or empty.")

        champions = [self.champion_repo.get_by_id(c_id) for c_id in squad.champion_ids if self.champion_repo.get_by_id(c_id)]
        squad_power = IdleExpeditionService.calculate_squad_power(champions)

        reward_preview = IdleExpeditionService.preview_rewards(
            squad_power=squad_power,
            biome=biome,
            duration_seconds=duration_seconds
        )

        bg_expedition = BackgroundExpedition(
            id=f"bg_{uuid.uuid4().hex[:8]}",
            biome_id=biome.id,
            biome_name=biome.name,
            squad_id=squad.id,
            squad_name=squad.name,
            start_time=time.time(),
            duration_seconds=duration_seconds,
            claimed=False,
            reward_preview=reward_preview,
        )

        saved = self.expedition_repo.save_background_expedition(bg_expedition)
        return saved.to_dict()


class ClaimBackgroundRewardsUseCase:
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        squad_repo: ISquadRepository,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository,
        player_repo: IPlayerRepository,
    ):
        self.expedition_repo = expedition_repo
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo
        self.player_repo = player_repo

    def execute(self, expedition_id: str) -> Dict[str, Any]:
        expedition = self.expedition_repo.get_background_expedition_by_id(expedition_id)
        if not expedition:
            raise ValueError(f"Background expedition {expedition_id} not found.")

        if expedition.claimed:
            raise ValueError("Expedition rewards have already been claimed.")

        if not expedition.is_finished():
            raise ValueError("Expedition is still in progress.")

        biome = self.expedition_repo.get_biome_by_id(expedition.biome_id)
        squad = self.squad_repo.get_by_id(expedition.squad_id)
        champions = [self.champion_repo.get_by_id(c_id) for c_id in squad.champion_ids] if squad else []
        squad_power = IdleExpeditionService.calculate_squad_power([c for c in champions if c])

        final_rewards = IdleExpeditionService.finalize_rewards(expedition, biome, squad_power)

        # Apply to player profile
        player = self.player_repo.get_profile()
        player.credits += final_rewards["credits"]
        player.crystals += final_rewards["crystals"]
        player.experience += final_rewards["experience"]
        self.player_repo.save_profile(player)

        # Save dropped gear to inventory
        for raw_art in final_rewards.get("raw_artifacts", []):
            self.artifact_repo.save(raw_art)

        expedition.claimed = True
        self.expedition_repo.save_background_expedition(expedition)

        return {
            "expedition": expedition.to_dict(),
            "claimed_rewards": {
                "credits": final_rewards["credits"],
                "crystals": final_rewards["crystals"],
                "experience": final_rewards["experience"],
                "artifacts": final_rewards["artifacts"],
            },
            "player": player.to_dict(),
        }
