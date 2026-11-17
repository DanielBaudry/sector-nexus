from abc import ABC, abstractmethod
from typing import List

from src.domain.entities.hierarchy_standing import HierarchyStanding


class IHierarchyRepository(ABC):
    @abstractmethod
    def get_planet(self, planet_id: str, boss_ids: List[str]) -> List[HierarchyStanding]:
        """Standings for these champions of a planet (fresh ones for champions never challenged)."""

    @abstractmethod
    def save(self, standing: HierarchyStanding) -> HierarchyStanding:
        pass
