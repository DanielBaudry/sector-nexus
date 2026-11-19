from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.archive_repository_sql import ArchiveRepositorySQL
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.use_cases.warp_beacon.warp_beacon_use_cases import GetWarpBeaconUseCase, WarpcopyHeroUseCase

router = APIRouter(prefix="/api/warp-beacon", tags=["Warp Beacon"])


class WarpcopyDTO(BaseModel):
    template_id: str


@router.get("")
def warp_beacon(session: Session = Depends(get_session)):
    return GetWarpBeaconUseCase(ChampionRepositorySQL(session), ArchiveRepositorySQL(session)).execute()


@router.post("/warpcopy")
def warpcopy(req: WarpcopyDTO, session: Session = Depends(get_session)):
    try:
        return WarpcopyHeroUseCase(ChampionRepositorySQL(session), ArchiveRepositorySQL(session)).execute(req.template_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
