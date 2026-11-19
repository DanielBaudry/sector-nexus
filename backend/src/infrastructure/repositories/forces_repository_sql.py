from sqlmodel import Session, select

from src.domain.entities.troop_forces import TroopForces
from src.domain.repositories.forces_repository import IForcesRepository
from src.infrastructure.database.models.sql_models import ResearchSQL, TroopStockSQL


class ForcesRepositorySQL(IForcesRepository):
    def __init__(self, session: Session):
        self.session = session

    def get(self) -> TroopForces:
        stock = {r.template_id: r.count for r in self.session.exec(select(TroopStockSQL)).all()}
        researched = {r.upgrade_id for r in self.session.exec(select(ResearchSQL)).all()}
        return TroopForces(stock=stock, researched=researched)

    def save(self, forces: TroopForces) -> TroopForces:
        for template_id, count in forces.stock.items():
            row = self.session.get(TroopStockSQL, template_id)
            if row:
                row.count = count
            else:
                self.session.add(TroopStockSQL(template_id=template_id, count=count))
        for upgrade_id in forces.researched:
            if not self.session.get(ResearchSQL, upgrade_id):
                self.session.add(ResearchSQL(upgrade_id=upgrade_id))
        self.session.commit()
        return forces
