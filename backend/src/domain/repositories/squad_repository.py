from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.squad import Squad


class ISquadRepository(ABC):
    @abstractmethod
    def get_by_id(self, squad_id: str) -> Optional[Squad]:
        pass

    @abstractmethod
    def get_all(self) -> List[Squad]:
        pass

    @abstractmethod
    def save(self, squad: Squad) -> Squad:
        pass
