from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.artifact_repository_sql import ArtifactRepositorySQL
from src.infrastructure.repositories.hero_kit_repository_seed import HeroKitRepositorySeed
from src.use_cases.champions.champion_use_cases import (
    GetChampionsUseCase,
    UpdateGambitsUseCase,
    EquipArtifactUseCase,
    UnequipArtifactUseCase,
    FeedChampionXPUseCase,
    RankUpChampionUseCase,
)
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.infrastructure.repositories.squad_repository_sql import SquadRepositorySQL
from src.presentation.schemas.dtos import UpdateGambitsDTO, EquipArtifactDTO, UnequipArtifactDTO, FeedXPDTO, RankUpDTO

router = APIRouter(prefix="/api/champions", tags=["Champions"])


@router.get("")
def get_champions(session: Session = Depends(get_session)):
    champ_repo = ChampionRepositorySQL(session)
    art_repo = ArtifactRepositorySQL(session)
    return GetChampionsUseCase(champ_repo, art_repo, HeroKitRepositorySeed()).execute()


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


@router.post("/{champion_id}/feed-xp")
def feed_xp(champion_id: str, req: FeedXPDTO, session: Session = Depends(get_session)):
    try:
        use_case = FeedChampionXPUseCase(ChampionRepositorySQL(session), PlayerRepositorySQL(session))
        return use_case.execute(champion_id, req.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{champion_id}/rank-up")
def rank_up(champion_id: str, req: RankUpDTO, session: Session = Depends(get_session)):
    try:
        use_case = RankUpChampionUseCase(
            ChampionRepositorySQL(session),
            ArtifactRepositorySQL(session),
            PlayerRepositorySQL(session),
            SquadRepositorySQL(session),
        )
        return use_case.execute(champion_id, req.fodder_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
