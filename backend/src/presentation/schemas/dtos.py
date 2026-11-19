from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class UpdateGambitsDTO(BaseModel):
    gambits: List[Dict[str, Any]]


class EquipArtifactDTO(BaseModel):
    artifact_id: str


class UnequipArtifactDTO(BaseModel):
    slot: str


class FeedXPDTO(BaseModel):
    amount: Optional[int] = None  # None = as much as possible


class RankUpDTO(BaseModel):
    fodder_ids: List[str]


class UpdateSquadDTO(BaseModel):
    id: str = "squad_alpha"
    name: str = "Alpha Vanguard"
    champion_ids: List[str]


class StartExpeditionDTO(BaseModel):
    biome_id: str
    squad_id: str = "squad_alpha"


class CardChoiceDTO(BaseModel):
    card_id: Optional[str] = None


class SetHierarchyTargetDTO(BaseModel):
    boss_id: str


class StartBossRunDTO(BaseModel):
    boss_id: str
    champion_ids: List[str] = Field(..., min_length=1, max_length=3)
    troop_ids: Optional[List[str]] = None  # troop reserve: template ids taken from the garrison
    difficulty: int = Field(1, ge=1, le=10)


class StartRunDTO(BaseModel):
    biome_id: str
    squad_id: str = "squad_alpha"
    # troop reserve: template ids taken from the barracks garrison (repeats allowed)
    troop_ids: Optional[List[str]] = None
    # heroes picked in the launch screen; omitted = the squad's heroes
    champion_ids: Optional[List[str]] = Field(None, min_length=1, max_length=4)
    difficulty: int = Field(1, ge=1, le=10)


class ChooseNodeDTO(BaseModel):
    node_id: str


class DeployHeroesDTO(BaseModel):
    # hero (champion) id -> lane index (0 = left, 1 = center, 2 = right)
    assignments: Dict[str, int]


class DeployTroopDTO(BaseModel):
    troop_id: str
    lane: int = Field(..., ge=0, le=2)


class PlayAbilityDTO(BaseModel):
    card_id: Optional[str] = None
    target_lane: Optional[int] = None
    target_unit_id: Optional[str] = None
