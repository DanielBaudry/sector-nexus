from fastapi import APIRouter, Depends
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL

router = APIRouter(prefix="/api/player", tags=["Player"])


@router.get("")
def get_player_profile(session: Session = Depends(get_session)):
    repo = PlayerRepositorySQL(session)
    return repo.get_profile().to_dict()


@router.post("/resupply")
def resupply_currencies(session: Session = Depends(get_session)):
    repo = PlayerRepositorySQL(session)
    profile = repo.get_profile()
    profile.crystals += 1000
    profile.credits += 50000
    profile.warp_shards += 10
    saved = repo.save_profile(profile)
    return saved.to_dict()
