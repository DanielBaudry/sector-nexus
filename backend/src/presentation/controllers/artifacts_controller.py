from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.use_cases.champions.champion_use_cases import UpgradeArtifactUseCase

router = APIRouter(prefix="/api/artifacts", tags=["Artifacts"])


@router.get("")
def get_artifacts(session: Session = Depends(get_session)):
    repo = ArtifactRepositorySQL(session)
    return [a.to_dict() for a in repo.get_all()]


@router.post("/{artifact_id}/upgrade")
def upgrade_artifact(artifact_id: str, session: Session = Depends(get_session)):
    try:
        art_repo = ArtifactRepositorySQL(session)
        player_repo = PlayerRepositorySQL(session)
        return UpgradeArtifactUseCase(art_repo, player_repo).execute(artifact_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
