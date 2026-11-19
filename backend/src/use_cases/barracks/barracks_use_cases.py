"""Barracks: research the tech tree and train troop packs for the garrison."""
from typing import Any, Dict

from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.repositories.forces_repository import IForcesRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.services.barracks_service import MAX_TRAIN_BATCH, BarracksService

FACTIONS = ["Terran Vanguard", "Bio-Swarm", "Astral Templars"]


class _BarracksUseCase:
    def __init__(self, expedition_repo: IExpeditionRepository, forces_repo: IForcesRepository, player_repo: IPlayerRepository):
        self.expedition_repo = expedition_repo
        self.forces_repo = forces_repo
        self.player_repo = player_repo
        self.service = BarracksService()

    def _names(self) -> Dict[str, str]:
        names = {u.id: u.name for u in self.expedition_repo.get_upgrades()}
        names.update({t.id: t.name for t in self.expedition_repo.get_troop_templates()})
        return names

    def view(self) -> Dict[str, Any]:
        forces = self.forces_repo.get()
        player = self.player_repo.get_profile()
        upgrades = sorted(self.expedition_repo.get_upgrades(), key=lambda u: (u.faction, u.order, u.id))
        names = self._names()
        bonuses = {f: self.service.faction_bonus(f, forces, upgrades) for f in FACTIONS}

        def status(requires, done=False):
            missing = self.service.missing(requires, forces)
            return "done" if done else ("locked" if missing else "available"), [names.get(m, m) for m in missing]

        tech = []
        for u in upgrades:
            state, missing = status(u.requires, u.id in forces.researched)
            tech.append({**u.to_dict(), "status": state, "missing": missing})
        troops = []
        for t in self.expedition_repo.get_troop_templates():
            state, missing = status(t.requires)
            troops.append({
                **t.to_dict(),
                "owned": forces.available(t.id),
                "unlocked": state == "available",
                "missing": missing,
                "stats": self.service.boosted_stats(t, bonuses.get(t.faction, {})),
            })
        return {
            "player": player.to_dict(),
            "factions": [{"name": f, "bonus": bonuses[f]} for f in FACTIONS],
            "upgrades": tech,
            "troops": troops,
            "garrison": sum(forces.stock.values()),
            "max_train_batch": MAX_TRAIN_BATCH,
        }


class GetBarracksUseCase(_BarracksUseCase):
    def execute(self) -> Dict[str, Any]:
        return self.view()


class ResearchUpgradeUseCase(_BarracksUseCase):
    def execute(self, upgrade_id: str) -> Dict[str, Any]:
        upgrade = next((u for u in self.expedition_repo.get_upgrades() if u.id == upgrade_id), None)
        if not upgrade:
            raise ValueError(f"Unknown upgrade {upgrade_id}.")
        forces = self.forces_repo.get()
        player = self.player_repo.get_profile()
        self.service.research(player, forces, upgrade, self._names())
        self.player_repo.save_profile(player)
        self.forces_repo.save(forces)
        return self.view()


class TrainTroopsUseCase(_BarracksUseCase):
    def execute(self, template_id: str, quantity: int) -> Dict[str, Any]:
        template = next((t for t in self.expedition_repo.get_troop_templates() if t.id == template_id), None)
        if not template:
            raise ValueError(f"Unknown troop type {template_id}.")
        forces = self.forces_repo.get()
        player = self.player_repo.get_profile()
        self.service.train(player, forces, template, quantity, self._names())
        self.player_repo.save_profile(player)
        self.forces_repo.save(forces)
        return self.view()
