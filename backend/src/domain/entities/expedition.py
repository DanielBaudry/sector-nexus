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


@dataclass
class BackgroundExpedition:
    id: str
    biome_id: str
    biome_name: str
    squad_id: str
    squad_name: str
    start_time: float
    duration_seconds: int
    claimed: bool
    reward_preview: Dict[str, Any] = field(default_factory=dict)

    def is_finished(self) -> bool:
        return (time.time() - self.start_time) >= self.duration_seconds

    def get_progress_percentage(self) -> float:
        if self.duration_seconds <= 0:
            return 100.0
        elapsed = time.time() - self.start_time
        pct = (elapsed / self.duration_seconds) * 100.0
        return min(100.0, max(0.0, round(pct, 1)))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "biome_id": self.biome_id,
            "biome_name": self.biome_name,
            "squad_id": self.squad_id,
            "squad_name": self.squad_name,
            "start_time": self.start_time,
            "duration_seconds": self.duration_seconds,
            "claimed": self.claimed,
            "is_finished": self.is_finished(),
            "progress_pct": self.get_progress_percentage(),
            "reward_preview": self.reward_preview,
        }
