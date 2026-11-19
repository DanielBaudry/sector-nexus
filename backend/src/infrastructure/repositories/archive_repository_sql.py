from sqlmodel import Session, select

from src.domain.entities.hero_archive import HeroArchive
from src.domain.repositories.archive_repository import IArchiveRepository
from src.infrastructure.database.models.sql_models import HeroArchiveSQL


class ArchiveRepositorySQL(IArchiveRepository):
    def __init__(self, session: Session):
        self.session = session

    def get(self) -> HeroArchive:
        rows = self.session.exec(select(HeroArchiveSQL)).all()
        return HeroArchive(
            blueprints={r.template_id for r in rows if r.blueprint},
            materials={r.template_id: r.materials for r in rows if r.materials},
        )

    def save(self, archive: HeroArchive) -> HeroArchive:
        for template_id in set(archive.blueprints) | set(archive.materials):
            row = self.session.get(HeroArchiveSQL, template_id) or HeroArchiveSQL(template_id=template_id)
            row.blueprint = template_id in archive.blueprints
            row.materials = archive.materials_for(template_id)
            self.session.add(row)
        self.session.commit()
        return archive
