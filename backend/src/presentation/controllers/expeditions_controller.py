from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.expedition_repository_sql import ExpeditionRepositorySQL
from src.infrastructure.repositories.squad_repository_sql import SquadRepositorySQL
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.use_cases.expeditions.expedition_use_cases import (
    StartActiveExpeditionUseCase,
    ExecuteTimedCardChoiceUseCase,
    TickExpeditionUseCase,
)
from src.presentation.schemas.dtos import StartExpeditionDTO, CardChoiceDTO

router = APIRouter(prefix="/api/expeditions", tags=["Expeditions"])


@router.get("/biomes")
def get_biomes(session: Session = Depends(get_session)):
    repo = ExpeditionRepositorySQL(session)
    return [b.to_dict() for b in repo.get_biomes()]


@router.get("/active")
def get_active_expedition(session: Session = Depends(get_session)):
    repo = ExpeditionRepositorySQL(session)
    active = repo.get_active_expedition()
    return active.to_dict() if active else None


@router.post("/start")
def start_expedition(req: StartExpeditionDTO, session: Session = Depends(get_session)):
    try:
        exp_repo = ExpeditionRepositorySQL(session)
        squad_repo = SquadRepositorySQL(session)
        champ_repo = ChampionRepositorySQL(session)
        art_repo = ArtifactRepositorySQL(session)
        use_case = StartActiveExpeditionUseCase(exp_repo, squad_repo, champ_repo, art_repo)
        return use_case.execute(req.biome_id, req.squad_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/choice")
def execute_choice(req: CardChoiceDTO, session: Session = Depends(get_session)):
    try:
        exp_repo = ExpeditionRepositorySQL(session)
        player_repo = PlayerRepositorySQL(session)
        use_case = ExecuteTimedCardChoiceUseCase(exp_repo, player_repo)
        return use_case.execute(req.card_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tick")
def tick_expedition(session: Session = Depends(get_session)):
    exp_repo = ExpeditionRepositorySQL(session)
    player_repo = PlayerRepositorySQL(session)
    use_case = TickExpeditionUseCase(exp_repo, player_repo)
    return use_case.execute()
