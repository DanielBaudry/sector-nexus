from typing import List, Dict, Any
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.entities.squad import Squad


class GetSquadsUseCase:
    def __init__(
        self,
        squad_repo: ISquadRepository,
        champion_repo: IChampionRepository
    ):
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo

    def execute(self) -> List[Dict[str, Any]]:
        squads = self.squad_repo.get_all()
        if not squads:
            # Create default squad with first available champions
            champions = self.champion_repo.get_all()
            first_4 = [c.id for c in champions[:4]]
            default_squad = Squad(
                id="squad_alpha",
                name="Alpha Vanguard",
                champion_ids=first_4,
            )
            saved = self.squad_repo.save(default_squad)
            squads = [saved]

        return [s.to_dict() for s in squads]


class UpdateSquadUseCase:
    def __init__(self, squad_repo: ISquadRepository):
        self.squad_repo = squad_repo

    def execute(self, squad_id: str, name: str, champion_ids: List[str]) -> Dict[str, Any]:
        squad = self.squad_repo.get_by_id(squad_id)
        if not squad:
            squad = Squad(id=squad_id, name=name, champion_ids=champion_ids[:4])
        else:
            squad.name = name
            squad.champion_ids = champion_ids[:4]

        saved = self.squad_repo.save(squad)
        return saved.to_dict()
