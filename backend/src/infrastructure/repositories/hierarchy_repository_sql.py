from typing import List

from sqlmodel import Session

from src.domain.entities.hierarchy_standing import HierarchyStanding
from src.domain.repositories.hierarchy_repository import IHierarchyRepository
from src.infrastructure.database.models.sql_models import HierarchyStandingSQL


class HierarchyRepositorySQL(IHierarchyRepository):
    def __init__(self, session: Session):
        self.session = session

    def get_planet(self, planet_id: str, boss_ids: List[str]) -> List[HierarchyStanding]:
        out = []
        for boss_id in boss_ids:
            row = self.session.get(HierarchyStandingSQL, boss_id)
            if row:
                out.append(HierarchyStanding(**row.model_dump()))
            else:
                out.append(HierarchyStanding(boss_id=boss_id, planet_id=planet_id))
        return out

    def save(self, standing: HierarchyStanding) -> HierarchyStanding:
        row = self.session.get(HierarchyStandingSQL, standing.boss_id)
        data = standing.to_dict()
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            row = HierarchyStandingSQL(**data)
            self.session.add(row)
        self.session.commit()
        return standing
