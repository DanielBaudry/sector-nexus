from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class SummonRequestDTO(BaseModel):
    banner_faction: str = "ALL"
    count: int = 1


class UpdateGambitsDTO(BaseModel):
    gambits: List[Dict[str, Any]]


class EquipArtifactDTO(BaseModel):
    artifact_id: str


class UnequipArtifactDTO(BaseModel):
    slot: str


class UpdateSquadDTO(BaseModel):
    id: str = "squad_alpha"
    name: str = "Alpha Vanguard"
    champion_ids: List[str]


class StartExpeditionDTO(BaseModel):
    biome_id: str
    squad_id: str = "squad_alpha"


class CardChoiceDTO(BaseModel):
    card_id: Optional[str] = None


class DispatchBackgroundDTO(BaseModel):
    biome_id: str
    squad_id: str = "squad_alpha"
    duration_seconds: int = 60
