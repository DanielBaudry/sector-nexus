from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.artifact import Artifact


class IArtifactRepository(ABC):
    @abstractmethod
    def get_by_id(self, artifact_id: str) -> Optional[Artifact]:
        pass

    @abstractmethod
    def get_all(self) -> List[Artifact]:
        pass

    @abstractmethod
    def get_by_champion_id(self, champion_id: str) -> List[Artifact]:
        pass

    @abstractmethod
    def save(self, artifact: Artifact) -> Artifact:
        pass

    @abstractmethod
    def delete(self, artifact_id: str) -> bool:
        pass
