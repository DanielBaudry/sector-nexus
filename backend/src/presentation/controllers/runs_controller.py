from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.expedition_repository_sql import ExpeditionRepositorySQL
from src.infrastructure.repositories.forces_repository_sql import ForcesRepositorySQL
from src.infrastructure.repositories.archive_repository_sql import ArchiveRepositorySQL
from src.infrastructure.repositories.hero_kit_repository_content import HeroKitRepositoryContent
from src.infrastructure.repositories.hierarchy_repository_sql import HierarchyRepositorySQL
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.infrastructure.repositories.squad_repository_sql import SquadRepositorySQL
from src.presentation.schemas.dtos import (
    ChooseNodeDTO,
    DeployHeroesDTO,
    DeployTroopDTO,
    PlayAbilityDTO,
    StartBossRunDTO,
    StartRunDTO,
)
from src.use_cases.expeditions.run_use_cases import (
    AbandonRunUseCase,
    ChooseRunNodeUseCase,
    DeployHeroesUseCase,
    DeployTroopUseCase,
    DismissRunUseCase,
    GetActiveRunUseCase,
    GetTroopCatalogUseCase,
    PlayHeroAbilityUseCase,
    StartBossEncounterUseCase,
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
        HeroKitRepositoryContent(),
        HierarchyRepositorySQL(session),
        ForcesRepositorySQL(session),
        ArchiveRepositorySQL(session),
    )
    return _bad_request(lambda: use_case.execute(req.biome_id, req.squad_id, req.troop_ids, req.difficulty, req.champion_ids))


@router.post("/boss/start")
def start_boss(req: StartBossRunDTO, session: Session = Depends(get_session)):
    use_case = StartBossEncounterUseCase(
        ExpeditionRepositorySQL(session),
        SquadRepositorySQL(session),
        ChampionRepositorySQL(session),
        ArtifactRepositorySQL(session),
        HeroKitRepositoryContent(),
        HierarchyRepositorySQL(session),
        ForcesRepositorySQL(session),
        ArchiveRepositorySQL(session),
    )
    return _bad_request(lambda: use_case.execute(req.boss_id, req.champion_ids, req.troop_ids, req.difficulty))


@router.post("/active/node")
def choose_node(req: ChooseNodeDTO, session: Session = Depends(get_session)):
    use_case = ChooseRunNodeUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.node_id))


@router.post("/active/deploy")
def deploy(req: DeployHeroesDTO, session: Session = Depends(get_session)):
    use_case = DeployHeroesUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.assignments))


@router.post("/active/troops/deploy")
def deploy_troop(req: DeployTroopDTO, session: Session = Depends(get_session)):
    use_case = DeployTroopUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.troop_id, req.lane))


@router.post("/active/ability")
def play_ability(req: PlayAbilityDTO, session: Session = Depends(get_session)):
    use_case = PlayHeroAbilityUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session))
    return _bad_request(lambda: use_case.execute(req.card_id, req.target_lane, req.target_unit_id))


@router.post("/active/tick")
def tick(session: Session = Depends(get_session)):
    return TickRunUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session)).execute()


@router.post("/active/abandon")
def abandon(session: Session = Depends(get_session)):
    use_case = AbandonRunUseCase(ExpeditionRepositorySQL(session), PlayerRepositorySQL(session), ArtifactRepositorySQL(session), HierarchyRepositorySQL(session), ForcesRepositorySQL(session), ArchiveRepositorySQL(session))
    return _bad_request(use_case.execute)


@router.delete("/active")
def dismiss(session: Session = Depends(get_session)):
    _bad_request(DismissRunUseCase(ExpeditionRepositorySQL(session)).execute)
    return {"ok": True}
