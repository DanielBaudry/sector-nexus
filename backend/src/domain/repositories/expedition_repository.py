from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.expedition import ActiveExpedition
from src.domain.entities.biome import Biome
from src.domain.entities.boss_encounter import BossEncounter
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.value_objects.troop import TroopTemplate


class IExpeditionRepository(ABC):
    @abstractmethod
    def get_biomes(self) -> List[Biome]:
        pass

    @abstractmethod
    def get_biome_by_id(self, biome_id: str) -> Optional[Biome]:
        pass

    @abstractmethod
    def get_active_expedition(self) -> Optional[ActiveExpedition]:
        pass

    @abstractmethod
    def save_active_expedition(self, expedition: Optional[ActiveExpedition]) -> None:
        pass

    @abstractmethod
    def get_boss_encounters(self) -> List[BossEncounter]:
        pass

    @abstractmethod
    def get_boss_encounter(self, boss_id: str) -> Optional[BossEncounter]:
        pass

    # ── Lane battle expedition runs ─────────────────────────────────────────
    @abstractmethod
    def get_active_run(self) -> Optional[ExpeditionRun]:
        pass

    @abstractmethod
    def save_active_run(self, run: Optional[ExpeditionRun]) -> None:
        pass

    @abstractmethod
    def get_troop_templates(self) -> List[TroopTemplate]:
        pass
