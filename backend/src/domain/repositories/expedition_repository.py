from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.expedition import ActiveExpedition, BackgroundExpedition
from src.domain.entities.biome import Biome
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import LaneScope
from src.domain.value_objects.troop import TroopTemplate
from typing import Dict


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
    def get_background_expeditions(self) -> List[BackgroundExpedition]:
        pass

    @abstractmethod
    def get_background_expedition_by_id(self, expedition_id: str) -> Optional[BackgroundExpedition]:
        pass

    @abstractmethod
    def save_background_expedition(self, expedition: BackgroundExpedition) -> BackgroundExpedition:
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

    @abstractmethod
    def get_ability_lane_scopes(self) -> Dict[str, LaneScope]:
        pass

    @abstractmethod
    def get_summon_abilities(self, champion_template_id: str) -> List[CombatCard]:
        pass
