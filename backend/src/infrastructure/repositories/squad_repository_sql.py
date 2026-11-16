from typing import List, Optional
from sqlmodel import Session, select
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.entities.squad import Squad
from src.infrastructure.database.models.sql_models import SquadSQL


class SquadRepositorySQL(ISquadRepository):
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, squad_id: str) -> Optional[Squad]:
        row = self.session.get(SquadSQL, squad_id)
        if not row:
            return None
        return Squad.from_dict(row.model_dump())

    def get_all(self) -> List[Squad]:
        rows = self.session.exec(select(SquadSQL)).all()
        return [Squad.from_dict(r.model_dump()) for r in rows]

    def save(self, squad: Squad) -> Squad:
        data = squad.to_dict()
        row = self.session.get(SquadSQL, squad.id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            row = SquadSQL(**data)
            self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return Squad.from_dict(row.model_dump())
