from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.expedition_repository_sql import ExpeditionRepositorySQL
from src.infrastructure.repositories.forces_repository_sql import ForcesRepositorySQL
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.use_cases.barracks.barracks_use_cases import GetBarracksUseCase, ResearchUpgradeUseCase, TrainTroopsUseCase

router = APIRouter(prefix="/api/barracks", tags=["Barracks"])


class ResearchDTO(BaseModel):
    upgrade_id: str


class TrainDTO(BaseModel):
    template_id: str
    quantity: int = Field(1, ge=1, le=10)


def _repos(session: Session):
    return ExpeditionRepositorySQL(session), ForcesRepositorySQL(session), PlayerRepositorySQL(session)


def _bad_request(fn):
    try:
        return fn()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def barracks(session: Session = Depends(get_session)):
    return GetBarracksUseCase(*_repos(session)).execute()


@router.post("/research")
def research(req: ResearchDTO, session: Session = Depends(get_session)):
    return _bad_request(lambda: ResearchUpgradeUseCase(*_repos(session)).execute(req.upgrade_id))


@router.post("/train")
def train(req: TrainDTO, session: Session = Depends(get_session)):
    return _bad_request(lambda: TrainTroopsUseCase(*_repos(session)).execute(req.template_id, req.quantity))
