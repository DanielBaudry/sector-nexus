from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.use_cases.champions.champion_use_cases import (
    GetChampionsUseCase,
    UpdateGambitsUseCase,
    EquipArtifactUseCase,
    UnequipArtifactUseCase,
)
from src.presentation.schemas.dtos import UpdateGambitsDTO, EquipArtifactDTO, UnequipArtifactDTO

router = APIRouter(prefix="/api/champions", tags=["Champions"])


@router.get("")
def get_champions(session: Session = Depends(get_session)):
    champ_repo = ChampionRepositorySQL(session)
    art_repo = ArtifactRepositorySQL(session)
    return GetChampionsUseCase(champ_repo, art_repo).execute()


@router.post("/{champion_id}/gambits")
def update_gambits(champion_id: str, req: UpdateGambitsDTO, session: Session = Depends(get_session)):
    try:
        champ_repo = ChampionRepositorySQL(session)
        return UpdateGambitsUseCase(champ_repo).execute(champion_id, req.gambits)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{champion_id}/equip")
def equip_artifact(champion_id: str, req: EquipArtifactDTO, session: Session = Depends(get_session)):
    try:
        champ_repo = ChampionRepositorySQL(session)
        art_repo = ArtifactRepositorySQL(session)
        return EquipArtifactUseCase(champ_repo, art_repo).execute(champion_id, req.artifact_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{champion_id}/unequip")
def unequip_artifact(champion_id: str, req: UnequipArtifactDTO, session: Session = Depends(get_session)):
    try:
        champ_repo = ChampionRepositorySQL(session)
        art_repo = ArtifactRepositorySQL(session)
        return UnequipArtifactUseCase(champ_repo, art_repo).execute(champion_id, req.slot)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
