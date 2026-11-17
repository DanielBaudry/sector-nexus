from typing import List, Dict, Any, Optional
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.hero_kit_repository import IHeroKitRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.entities.champion import Champion
from src.domain.value_objects.gambit import GambitRule


class GetChampionsUseCase:
    def __init__(
        self,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository,
        hero_kit_repo: Optional[IHeroKitRepository] = None,
    ):
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo
        self.hero_kit_repo = hero_kit_repo

    def execute(self) -> List[Dict[str, Any]]:
        champions = self.champion_repo.get_all()
        artifacts = {a.id: a for a in self.artifact_repo.get_all()}

        result = []
        for c in champions:
            data = c.to_dict()
            effective_stats = c.get_effective_stats(artifacts)
            data["effective_stats"] = effective_stats.to_dict()
            data.update(c.progression_view())
            if self.hero_kit_repo:
                data.update(self.hero_kit_repo.kit_view(c.template_id, c.cards))
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
    """One RSL-style upgrade attempt: credits are spent whether it succeeds or not."""

    def __init__(self, artifact_repo: IArtifactRepository, player_repo: IPlayerRepository, rng=None):
        self.artifact_repo = artifact_repo
        self.player_repo = player_repo
        self.rng = rng

    def execute(self, artifact_id: str) -> Dict[str, Any]:
        artifact = self.artifact_repo.get_by_id(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found.")
        if artifact.is_maxed:
            raise ValueError("Artifact is already at +16.")

        cost = artifact.upgrade_cost()
        player = self.player_repo.get_profile()
        if player.credits < cost:
            raise ValueError(f"Insufficient credits ({player.credits}/{cost}).")

        player.credits -= cost
        result = artifact.try_upgrade(self.rng)
        self.player_repo.save_profile(player)
        saved = self.artifact_repo.save(artifact)

        return {
            "result": {**result, "cost": cost},
            "artifact": saved.to_view(),
            "player": player.to_dict(),
        }


class FeedChampionXPUseCase:
    """Spend XP capsules from the player's pool on a champion (capped at the rank's max level)."""

    def __init__(self, champion_repo: IChampionRepository, player_repo: IPlayerRepository):
        self.champion_repo = champion_repo
        self.player_repo = player_repo

    def execute(self, champion_id: str, amount: Optional[int] = None) -> Dict[str, Any]:
        # Owned champions only (get_by_id also resolves catalog templates).
        champion = next((c for c in self.champion_repo.get_all() if c.id == champion_id), None)
        if not champion:
            raise ValueError(f"Champion {champion_id} not found.")
        player = self.player_repo.get_profile()
        if champion.is_level_maxed:
            raise ValueError(f"{champion.name} is at max level for rank {champion.rank}. Rank up first.")
        budget = player.champion_xp if amount is None else min(max(0, amount), player.champion_xp)
        if budget <= 0:
            raise ValueError("No champion XP available. Earn XP capsules on expeditions.")

        used = champion.gain_xp(budget)
        player.champion_xp -= used
        self.player_repo.save_profile(player)
        saved = self.champion_repo.save(champion)
        return {
            "champion": {**saved.to_dict(), **saved.progression_view()},
            "xp_used": used,
            "player": player.to_dict(),
        }


class RankUpChampionUseCase:
    """
    RSL-style rank up: champion must be max level; consumes `rank` fodder champions
    of the same rank or higher (not in a squad) plus credits. Level resets to 1.
    """

    def __init__(
        self,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository,
        player_repo: IPlayerRepository,
        squad_repo,
    ):
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo
        self.player_repo = player_repo
        self.squad_repo = squad_repo

    def execute(self, champion_id: str, fodder_ids: List[str]) -> Dict[str, Any]:
        owned = {c.id: c for c in self.champion_repo.get_all()}
        champion = owned.get(champion_id)
        if not champion:
            raise ValueError(f"Champion {champion_id} not found.")
        view = champion.progression_view()
        if not view["can_rank_up"]:
            champion.rank_up()  # raises the precise reason

        needed = view["rank_up_fodder"]
        fodder_ids = list(dict.fromkeys(fodder_ids))
        if len(fodder_ids) != needed:
            raise ValueError(f"Rank {champion.rank} -> {champion.rank + 1} needs exactly {needed} fodder champion(s).")
        in_squads = {cid for s in self.squad_repo.get_all() for cid in s.champion_ids}
        fodder = []
        for fid in fodder_ids:
            f = owned.get(fid)
            if not f or fid == champion_id:
                raise ValueError("Invalid fodder selection.")
            if f.rank < champion.rank:
                raise ValueError(f"{f.name} must be rank {champion.rank} or higher.")
            if fid in in_squads:
                raise ValueError(f"{f.name} is assigned to a squad. Remove it first.")
            fodder.append(f)

        cost = view["rank_up_cost"]
        player = self.player_repo.get_profile()
        if player.credits < cost:
            raise ValueError(f"Insufficient credits ({player.credits}/{cost}).")

        # Fodder gear returns to the inventory.
        for f in fodder:
            for art_id in f.equipped_artifact_ids.values():
                art = self.artifact_repo.get_by_id(art_id)
                if art:
                    art.equipped_to = None
                    self.artifact_repo.save(art)
            self.champion_repo.delete(f.id)

        player.credits -= cost
        champion.rank_up()
        self.player_repo.save_profile(player)
        saved = self.champion_repo.save(champion)
        return {
            "champion": {**saved.to_dict(), **saved.progression_view()},
            "consumed": [f.id for f in fodder],
            "player": player.to_dict(),
        }
