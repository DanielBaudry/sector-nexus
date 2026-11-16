from typing import List, Dict, Any, Optional
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.entities.champion import Champion
from src.domain.value_objects.gambit import GambitRule


class GetChampionsUseCase:
    def __init__(
        self,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository
    ):
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo

    def execute(self) -> List[Dict[str, Any]]:
        champions = self.champion_repo.get_all()
        artifacts = {a.id: a for a in self.artifact_repo.get_all()}

        result = []
        for c in champions:
            data = c.to_dict()
            effective_stats = c.get_effective_stats(artifacts)
            data["effective_stats"] = effective_stats.to_dict()
            result.append(data)
        return result


class UpdateGambitsUseCase:
    def __init__(self, champion_repo: IChampionRepository):
        self.champion_repo = champion_repo

    def execute(self, champion_id: str, new_gambits: List[Dict[str, Any]]) -> Dict[str, Any]:
        champion = self.champion_repo.get_by_id(champion_id)
        if not champion:
            raise ValueError(f"Champion {champion_id} not found.")

        champion.gambits = [GambitRule.from_dict(g) for g in new_gambits]
        saved = self.champion_repo.save(champion)
        return saved.to_dict()


class EquipArtifactUseCase:
    def __init__(
        self,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository
    ):
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo

    def execute(self, champion_id: str, artifact_id: str) -> Dict[str, Any]:
        champion = self.champion_repo.get_by_id(champion_id)
        if not champion:
            raise ValueError(f"Champion {champion_id} not found.")

        artifact = self.artifact_repo.get_by_id(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found.")

        slot_key = artifact.slot.value if hasattr(artifact.slot, "value") else str(artifact.slot)

        # Unequip existing in that slot
        old_art_id = champion.equipped_artifact_ids.get(slot_key)
        if old_art_id:
            old_art = self.artifact_repo.get_by_id(old_art_id)
            if old_art:
                old_art.equipped_to = None
                self.artifact_repo.save(old_art)

        # If artifact was equipped on someone else, unequip it from them
        if artifact.equipped_to and artifact.equipped_to != champion_id:
            other_champ = self.champion_repo.get_by_id(artifact.equipped_to)
            if other_champ and slot_key in other_champ.equipped_artifact_ids:
                del other_champ.equipped_artifact_ids[slot_key]
                self.champion_repo.save(other_champ)

        artifact.equipped_to = champion_id
        self.artifact_repo.save(artifact)

        champion.equipped_artifact_ids[slot_key] = artifact_id
        saved_champ = self.champion_repo.save(champion)
        return saved_champ.to_dict()


class UnequipArtifactUseCase:
    def __init__(
        self,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository
    ):
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo

    def execute(self, champion_id: str, slot: str) -> Dict[str, Any]:
        champion = self.champion_repo.get_by_id(champion_id)
        if not champion:
            raise ValueError(f"Champion {champion_id} not found.")

        art_id = champion.equipped_artifact_ids.get(slot)
        if art_id:
            del champion.equipped_artifact_ids[slot]
            self.champion_repo.save(champion)

            artifact = self.artifact_repo.get_by_id(art_id)
            if artifact:
                artifact.equipped_to = None
                self.artifact_repo.save(artifact)

        return champion.to_dict()


class UpgradeArtifactUseCase:
    def __init__(
        self,
        artifact_repo: IArtifactRepository,
        player_repo: IPlayerRepository
    ):
        self.artifact_repo = artifact_repo
        self.player_repo = player_repo

    def execute(self, artifact_id: str) -> Dict[str, Any]:
        artifact = self.artifact_repo.get_by_id(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found.")

        cost = artifact.level * 1500
        player = self.player_repo.get_profile()
        if player.credits < cost:
            raise ValueError(f"Insufficient credits ({player.credits}/{cost}).")

        player.credits -= cost
        artifact.upgrade()

        self.player_repo.save_profile(player)
        saved_art = self.artifact_repo.save(artifact)

        return {
            "artifact": saved_art.to_dict(),
            "player": player.to_dict(),
        }
