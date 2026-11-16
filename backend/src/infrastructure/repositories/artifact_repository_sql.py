from typing import List, Optional
from sqlmodel import Session, select
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.entities.artifact import Artifact
from src.infrastructure.database.models.sql_models import ArtifactSQL


class ArtifactRepositorySQL(IArtifactRepository):
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, artifact_id: str) -> Optional[Artifact]:
        row = self.session.get(ArtifactSQL, artifact_id)
        if not row:
            return None
        return Artifact.from_dict(row.model_dump())

    def get_all(self) -> List[Artifact]:
        rows = self.session.exec(select(ArtifactSQL)).all()
        return [Artifact.from_dict(r.model_dump()) for r in rows]

    def get_by_champion_id(self, champion_id: str) -> List[Artifact]:
        stmt = select(ArtifactSQL).where(ArtifactSQL.equipped_to == champion_id)
        rows = self.session.exec(stmt).all()
        return [Artifact.from_dict(r.model_dump()) for r in rows]

    def save(self, artifact: Artifact) -> Artifact:
        data = artifact.to_dict()
        row = self.session.get(ArtifactSQL, artifact.id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            row = ArtifactSQL(**data)
            self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return Artifact.from_dict(row.model_dump())

    def delete(self, artifact_id: str) -> bool:
        row = self.session.get(ArtifactSQL, artifact_id)
        if row:
            self.session.delete(row)
            self.session.commit()
            return True
        return False
