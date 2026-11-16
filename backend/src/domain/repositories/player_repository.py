from abc import ABC, abstractmethod
from typing import Optional
from src.domain.entities.player import PlayerProfile


class IPlayerRepository(ABC):
    @abstractmethod
    def get_profile(self) -> PlayerProfile:
        pass

    @abstractmethod
    def save_profile(self, profile: PlayerProfile) -> PlayerProfile:
        pass
