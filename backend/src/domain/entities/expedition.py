from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time


@dataclass
class ActiveExpedition:
    id: str
    biome_id: str
    biome_name: str
    squad_id: str
    room_index: int
    total_rooms: int
    status: str  # "IN_PROGRESS", "VICTORY", "DEFEAT"
    allies: List[Dict[str, Any]] = field(default_factory=list)
    enemies: List[Dict[str, Any]] = field(default_factory=list)
    current_turn_entity_type: Optional[str] = None  # "ALLY" or "ENEMY"
    current_turn_entity_id: Optional[str] = None
    drawn_cards: List[Dict[str, Any]] = field(default_factory=list)
    turn_started_at: float = field(default_factory=time.time)
    turn_time_limit_seconds: float = 7.0
    combat_log: List[str] = field(default_factory=list)
    accumulated_rewards: Dict[str, Any] = field(default_factory=lambda: {
        "credits": 0,
        "crystals": 0,
        "artifacts": [],
        "experience": 0
    })

    def is_turn_timed_out(self) -> bool:
        if self.current_turn_entity_type != "ALLY":
            return False
        return (time.time() - self.turn_started_at) > self.turn_time_limit_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "biome_id": self.biome_id,
            "biome_name": self.biome_name,
            "squad_id": self.squad_id,
            "room_index": self.room_index,
            "total_rooms": self.total_rooms,
            "status": self.status,
            "allies": self.allies,
            "enemies": self.enemies,
            "current_turn_entity_type": self.current_turn_entity_type,
            "current_turn_entity_id": self.current_turn_entity_id,
            "drawn_cards": self.drawn_cards,
            "turn_started_at": self.turn_started_at,
            "turn_time_limit_seconds": self.turn_time_limit_seconds,
            "combat_log": self.combat_log,
            "accumulated_rewards": self.accumulated_rewards,
        }
