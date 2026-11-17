from typing import List, Optional
from sqlmodel import Session, select
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.entities.champion import Champion
from src.infrastructure.database.models.sql_models import ChampionSQL
from src.infrastructure.database.seed_data import get_seed_champion_templates


class ChampionRepositorySQL(IChampionRepository):
    def __init__(self, session: Session):
        self.session = session
        self._templates = {t.template_id: t for t in get_seed_champion_templates()}

    def get_by_id(self, champion_id: str) -> Optional[Champion]:
        row = self.session.get(ChampionSQL, champion_id)
        if not row:
            # check if it's a template
            if champion_id in self._templates:
                return self._templates[champion_id]
            return None
        return Champion.from_dict(row.model_dump())

    def get_all(self) -> List[Champion]:
        rows = self.session.exec(select(ChampionSQL)).all()
        return [Champion.from_dict(r.model_dump()) for r in rows]

    def save(self, champion: Champion) -> Champion:
        data = champion.to_dict()
        row = self.session.get(ChampionSQL, champion.id)
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            row = ChampionSQL(**data)
            self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return Champion.from_dict(row.model_dump())

    def delete(self, champion_id: str) -> bool:
        row = self.session.get(ChampionSQL, champion_id)
        if not row:
            return False
        self.session.delete(row)
        self.session.commit()
        return True

    def get_templates(self) -> List[Champion]:
        return list(self._templates.values())
