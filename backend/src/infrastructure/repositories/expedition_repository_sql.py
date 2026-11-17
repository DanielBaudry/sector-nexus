from typing import List, Optional
from sqlmodel import Session, select
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.entities.expedition import ActiveExpedition
from src.domain.entities.biome import Biome
from src.domain.entities.boss_encounter import BossEncounter
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.content.library import get_library

# In-memory storage for active interactive combat sessions
_active_expedition_store: Optional[ActiveExpedition] = None
# In-memory storage for the lane-battle expedition run
_active_run_store: Optional[ExpeditionRun] = None


class ExpeditionRepositorySQL(IExpeditionRepository):
    def __init__(self, session: Session):
        self.session = session
        library = get_library()
        self._biomes = {b.id: b for b in library.biomes()}
        self._bosses = {b.id: b for b in library.boss_encounters()}
        self._troops = library.troop_templates()

    def get_biomes(self) -> List[Biome]:
        return list(self._biomes.values())

    def get_biome_by_id(self, biome_id: str) -> Optional[Biome]:
        return self._biomes.get(biome_id)

    def get_boss_encounters(self) -> List[BossEncounter]:
        return list(self._bosses.values())

    def get_boss_encounter(self, boss_id: str) -> Optional[BossEncounter]:
        return self._bosses.get(boss_id)

    def get_active_expedition(self) -> Optional[ActiveExpedition]:
        global _active_expedition_store
        return _active_expedition_store

    def save_active_expedition(self, expedition: Optional[ActiveExpedition]) -> None:
        global _active_expedition_store
        _active_expedition_store = expedition

    # ── Lane battle expedition runs ─────────────────────────────────────────
    def get_active_run(self) -> Optional[ExpeditionRun]:
        return _active_run_store

    def save_active_run(self, run: Optional[ExpeditionRun]) -> None:
        global _active_run_store
        _active_run_store = run

    def get_troop_templates(self) -> List[TroopTemplate]:
        return list(self._troops)
