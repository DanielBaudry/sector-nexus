from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.expedition import ActiveExpedition, BackgroundExpedition
from src.domain.entities.biome import Biome


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
