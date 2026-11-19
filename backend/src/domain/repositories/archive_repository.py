from abc import ABC, abstractmethod

from src.domain.entities.hero_archive import HeroArchive


class IArchiveRepository(ABC):
    """Hero blueprints and print materials (Warp Beacon)."""

    @abstractmethod
    def get(self) -> HeroArchive:
        pass

    @abstractmethod
    def save(self, archive: HeroArchive) -> HeroArchive:
        pass
