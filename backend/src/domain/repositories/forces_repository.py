from abc import ABC, abstractmethod

from src.domain.entities.troop_forces import TroopForces


class IForcesRepository(ABC):
    """The player's troop garrison and researched barracks techs."""

    @abstractmethod
    def get(self) -> TroopForces:
        pass

    @abstractmethod
    def save(self, forces: TroopForces) -> TroopForces:
        pass
