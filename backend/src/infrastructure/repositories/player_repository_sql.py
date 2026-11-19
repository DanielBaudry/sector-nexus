from typing import Optional
from sqlmodel import Session, select
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.entities.player import PlayerProfile
from src.infrastructure.database.models.sql_models import PlayerProfileSQL


class PlayerRepositorySQL(IPlayerRepository):
    def __init__(self, session: Session):
        self.session = session

    def get_profile(self) -> PlayerProfile:
        stmt = select(PlayerProfileSQL)
        row = self.session.exec(stmt).first()
        if not row:
            # Create default profile
            row = PlayerProfileSQL(
                id="commander_main",
                username="Dominion Commander",
                crystals=2000,
                credits=75000,
                level=1,
                experience=0,
            )
            self.session.add(row)
            self.session.commit()
            self.session.refresh(row)
        return PlayerProfile.from_dict(row.model_dump())

    def save_profile(self, profile: PlayerProfile) -> PlayerProfile:
        row = self.session.get(PlayerProfileSQL, profile.id)
        data = profile.to_dict()
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            row = PlayerProfileSQL(**data)
            self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return PlayerProfile.from_dict(row.model_dump())
