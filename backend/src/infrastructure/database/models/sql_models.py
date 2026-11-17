from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON


class ChampionSQL(SQLModel, table=True):
    __tablename__ = "champions"

    id: str = Field(primary_key=True)
    template_id: str
    name: str
    title: str
    faction: str
    role: str
    rarity: str
    level: int = 1
    experience: int = 0
    base_stats: dict = Field(default_factory=dict, sa_column=Column(JSON))
    cards: list = Field(default_factory=list, sa_column=Column(JSON))
    gambits: list = Field(default_factory=list, sa_column=Column(JSON))
    equipped_artifact_ids: dict = Field(default_factory=dict, sa_column=Column(JSON))
    avatar_color: str = "#3b82f6"
    avatar_icon: str = "Shield"
    rank: int = 0


class ArtifactSQL(SQLModel, table=True):
    __tablename__ = "artifacts"

    id: str = Field(primary_key=True)
    template_id: str
    name: str
    slot: str
    rarity: str
    set_type: str
    level: int = 1
    main_stat_name: str
    main_stat_value: float
    sub_stats: list = Field(default_factory=list, sa_column=Column(JSON))
    equipped_to: Optional[str] = None
    rank: int = 5


class SquadSQL(SQLModel, table=True):
    __tablename__ = "squads"

    id: str = Field(primary_key=True)
    name: str
    champion_ids: list = Field(default_factory=list, sa_column=Column(JSON))


class PlayerProfileSQL(SQLModel, table=True):
    __tablename__ = "player_profile"

    id: str = Field(primary_key=True)
    username: str
    crystals: int = 1500
    credits: int = 50000
    warp_shards: int = 15
    level: int = 1
    experience: int = 0
    champion_xp: int = 0


class HierarchyStandingSQL(SQLModel, table=True):
    __tablename__ = "hierarchy_standings"

    boss_id: str = Field(primary_key=True)
    planet_id: str = Field(index=True)
    influence: int = 0
    defeated: bool = False
    losses: int = 0
    targeted: bool = False
