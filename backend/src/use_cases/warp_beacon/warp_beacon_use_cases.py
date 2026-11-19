"""Warp Beacon: browse hero blueprints and warpcopy (3D-print) heroes from print materials."""
from typing import Any, Dict

from src.domain.repositories.archive_repository import IArchiveRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.services.warp_forge_service import PRINT_COST, WarpForgeService


class _WarpBeaconUseCase:
    def __init__(self, champion_repo: IChampionRepository, archive_repo: IArchiveRepository):
        self.champion_repo = champion_repo
        self.archive_repo = archive_repo

    def view(self) -> Dict[str, Any]:
        archive = self.archive_repo.get()
        owned: Dict[str, int] = {}
        for c in self.champion_repo.get_all():
            owned[c.template_id] = owned.get(c.template_id, 0) + 1
        heroes = []
        for t in self.champion_repo.get_templates():
            mats = archive.materials_for(t.template_id)
            heroes.append({
                "template_id": t.template_id,
                "name": t.name,
                "title": t.title,
                "faction": t.faction.value,
                "role": t.role.value,
                "rarity": t.rarity.value,
                "blueprint": t.template_id in archive.blueprints,
                "materials": mats,
                "progress": min(1.0, mats / PRINT_COST),
                "ready": t.template_id in archive.blueprints and mats >= PRINT_COST,
                "owned": owned.get(t.template_id, 0),
            })
        return {
            "print_cost": PRINT_COST,
            "blueprints": len(archive.blueprints),
            "total": len(heroes),
            "heroes": heroes,
        }


class GetWarpBeaconUseCase(_WarpBeaconUseCase):
    def execute(self) -> Dict[str, Any]:
        return self.view()


class WarpcopyHeroUseCase(_WarpBeaconUseCase):
    def execute(self, template_id: str) -> Dict[str, Any]:
        template = next((t for t in self.champion_repo.get_templates() if t.template_id == template_id), None)
        if not template:
            raise ValueError(f"Unknown hero {template_id}.")
        archive = self.archive_repo.get()
        champion = WarpForgeService.warpcopy(archive, template)
        saved = self.champion_repo.save(champion)
        self.archive_repo.save(archive)
        return {"champion": saved.to_dict(), **self.view()}
