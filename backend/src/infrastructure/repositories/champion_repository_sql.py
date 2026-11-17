from typing import List, Optional
from sqlmodel import Session, select
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.entities.champion import Champion
from src.infrastructure.database.models.sql_models import ChampionSQL
from src.infrastructure.content.library import get_library


class ChampionRepositorySQL(IChampionRepository):
    """
    Owned champions live in the database, but their *design* (stats, abilities, identity)
    always comes from the hero's content file — so editing content/heroes/*.json updates
    every copy players already own. Player progress (level, rank, XP, gear, gambits) is kept.
    """

    def __init__(self, session: Session):
        self.session = session
        self._library = get_library()

    def _hydrate(self, row: ChampionSQL) -> Champion:
        champ = Champion.from_dict(row.model_dump())
        template = self._library.champion_template(champ.template_id)
        if template:
            champ.name = template.name
            champ.title = template.title
            champ.faction = template.faction
            champ.role = template.role
            champ.rarity = template.rarity
            champ.base_stats = template.base_stats
            champ.cards = template.cards
            champ.avatar_color = template.avatar_color
            champ.avatar_icon = template.avatar_icon
            # Player-edited gambits survive unless they point at abilities that no longer exist.
            ids = {c.id for c in template.cards}
            if not champ.gambits or any(g.card_id not in ids for g in champ.gambits):
                champ.gambits = template.gambits
        return champ

    def get_by_id(self, champion_id: str) -> Optional[Champion]:
        row = self.session.get(ChampionSQL, champion_id)
        if not row:
            # check if it's a template
            return self._library.champion_template(champion_id)
        return self._hydrate(row)

    def get_all(self) -> List[Champion]:
        rows = self.session.exec(select(ChampionSQL)).all()
        return [self._hydrate(r) for r in rows]

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
        return self._hydrate(row)

    def delete(self, champion_id: str) -> bool:
        row = self.session.get(ChampionSQL, champion_id)
        if not row:
            return False
        self.session.delete(row)
        self.session.commit()
        return True

    def get_templates(self) -> List[Champion]:
        return self._library.champion_templates()
