from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.champion import Champion


class IChampionRepository(ABC):
    @abstractmethod
    def get_by_id(self, champion_id: str) -> Optional[Champion]:
        pass

    @abstractmethod
    def get_all(self) -> List[Champion]:
        pass

    @abstractmethod
    def save(self, champion: Champion) -> Champion:
        pass

    @abstractmethod
    def get_templates(self) -> List[Champion]:
        pass
