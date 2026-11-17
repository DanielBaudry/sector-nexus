from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.expedition_repository_sql import ExpeditionRepositorySQL
from src.infrastructure.repositories.hierarchy_repository_sql import HierarchyRepositorySQL
from src.presentation.schemas.dtos import SetHierarchyTargetDTO
from src.use_cases.expeditions.run_use_cases import GetPlanetHierarchyUseCase, SetHierarchyTargetUseCase

router = APIRouter(prefix="/api/hierarchy", tags=["Planet Hierarchy"])


@router.get("/{planet_id}")
def planet_hierarchy(planet_id: str, session: Session = Depends(get_session)):
    try:
        return GetPlanetHierarchyUseCase(ExpeditionRepositorySQL(session), HierarchyRepositorySQL(session)).execute(planet_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/target")
def set_target(req: SetHierarchyTargetDTO, session: Session = Depends(get_session)):
    try:
        return SetHierarchyTargetUseCase(ExpeditionRepositorySQL(session), HierarchyRepositorySQL(session)).execute(req.boss_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
