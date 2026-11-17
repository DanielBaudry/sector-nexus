from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.expedition_repository_sql import ExpeditionRepositorySQL
from src.infrastructure.repositories.hero_kit_repository_seed import HeroKitRepositorySeed
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.infrastructure.repositories.squad_repository_sql import SquadRepositorySQL
from src.presentation.schemas.dtos import ChooseNodeDTO, DeployHeroesDTO, PlayAbilityDTO, StartRunDTO
from src.use_cases.expeditions.run_use_cases import (
    AbandonRunUseCase,
    ChooseRunNodeUseCase,
    DeployHeroesUseCase,
    DismissRunUseCase,
    GetActiveRunUseCase,
    GetTroopCatalogUseCase,
    PlayHeroAbilityUseCase,
    StartExpeditionRunUseCase,
    TickRunUseCase,
)

router = APIRouter(prefix="/api/runs", tags=["Expedition Runs"])


def _bad_request(fn):
    try:
        return fn()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/troops")
def troop_catalog(session: Session = Depends(get_session)):
    return GetTroopCatalogUseCase(ExpeditionRepositorySQL(session)).execute()


@router.get("/active")
def active_run(session: Session = Depends(get_session)):
    return GetActiveRunUseCase(ExpeditionRepositorySQL(session)).execute()


@router.post("/start")
def start_run(req: StartRunDTO, session: Session = Depends(get_session)):
    use_case = StartExpeditionRunUseCase(
        ExpeditionRepositorySQL(session),
        SquadRepositorySQL(session),
        ChampionRepositorySQL(session),
        ArtifactRepositorySQL(session),
        HeroKitRepositorySeed(),
    )
    return _bad_request(lambda: use_case.execute(req.biome_id, req.squad_id, req.troop_assignments, req.difficulty))


@router.post("/active/node")
def choose_node(req: ChooseNodeDTO, session: Session = Depends(get_session)):
    use_case = ChooseRunNodeUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.node_id))


@router.post("/active/deploy")
def deploy(req: DeployHeroesDTO, session: Session = Depends(get_session)):
    use_case = DeployHeroesUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.assignments))


@router.post("/active/ability")
def play_ability(req: PlayAbilityDTO, session: Session = Depends(get_session)):
    use_case = PlayHeroAbilityUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.card_id, req.target_lane, req.target_unit_id))


@router.post("/active/tick")
def tick(session: Session = Depends(get_session)):
    return TickRunUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session)).execute()


@router.post("/active/abandon")
def abandon(session: Session = Depends(get_session)):
    use_case = AbandonRunUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session))
    return _bad_request(use_case.execute)


@router.delete("/active")
def dismiss(session: Session = Depends(get_session)):
    _bad_request(DismissRunUseCase(ExpeditionRepositorySQL(session)).execute)
    return {"ok": True}
