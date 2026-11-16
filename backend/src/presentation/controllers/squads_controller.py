from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.squad_repository_sql import SquadRepositorySQL
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.use_cases.squads.squad_use_cases import GetSquadsUseCase, UpdateSquadUseCase
from src.presentation.schemas.dtos import UpdateSquadDTO

router = APIRouter(prefix="/api/squads", tags=["Squads"])


@router.get("")
def get_squads(session: Session = Depends(get_session)):
    squad_repo = SquadRepositorySQL(session)
    champ_repo = ChampionRepositorySQL(session)
    return GetSquadsUseCase(squad_repo, champ_repo).execute()


@router.post("")
def update_squad(req: UpdateSquadDTO, session: Session = Depends(get_session)):
    try:
        squad_repo = SquadRepositorySQL(session)
        return UpdateSquadUseCase(squad_repo).execute(req.id, req.name, req.champion_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
