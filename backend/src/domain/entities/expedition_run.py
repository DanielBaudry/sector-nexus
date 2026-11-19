from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.domain.entities.battle import MANA_CAP, MANA_FLOOR, Battle, LaneUnit
from src.domain.value_objects.enums import BattleStatus, NodeType, RunStatus


@dataclass
class MapNode:
    id: str
    row: int
    col: int
    type: NodeType
    next_ids: List[str] = field(default_factory=list)
    visited: bool = False
    threat: int = 1  # difficulty tier, grows with depth
    objective_hint: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "row": self.row,
            "col": self.col,
            "type": self.type.value,
            "next_ids": self.next_ids,
            "visited": self.visited,
            "threat": self.threat,
            "objective_hint": self.objective_hint,
        }


@dataclass
class ExpeditionRun:
    """
    A planet exploration run: a branching node map walked by one squad.
    Hero HP/deaths and troop pack losses persist from node to node.
    """
    id: str
    biome_id: str
    biome_name: str
    squad_id: str
    status: RunStatus
    nodes: List[MapNode] = field(default_factory=list)
    current_node_id: Optional[str] = None
    heroes: List[LaneUnit] = field(default_factory=list)
    # Troop reserve: packs picked before the expedition. Deployed with mana mid-battle,
    # they then hold their lane (deployed_lane) until destroyed or the run ends.
    troops: List[LaneUnit] = field(default_factory=list)
    mana: int = 0  # carried between battles; the battle holds the live value while fighting
    battle: Optional[Battle] = None
    log: List[str] = field(default_factory=list)
    # Loot accumulated node by node: credits, crystals, champion XP capsules and artifact dicts.
    rewards: Dict[str, Any] = field(default_factory=lambda: {"credits": 0, "crystals": 0, "champion_xp": 0, "artifacts": []})
    payout: Optional[Dict[str, Any]] = None  # what the player actually banks (set when the run ends)
    rewards_paid: bool = False
    difficulty: int = 1  # 1-10, see value_objects.difficulty
    mode: str = "expedition"  # "expedition" (node map) | "boss" (single boss encounter)
    boss_id: Optional[str] = None
    # Hierarchy: the champion this expedition gathers Influence against (and its guard elite).
    influence_target_id: Optional[str] = None
    influence_target_name: str = ""
    influence_gained: int = 0
    influence_banked: Optional[int] = None
    target_guard: Optional[Dict[str, Any]] = None
    hierarchy_result: Optional[Dict[str, Any]] = None  # boss mode: claimed / adaptation gained
    # Warp Beacon loot: every hero that can drop (template id -> name) and blueprints already owned.
    hero_pool: Dict[str, str] = field(default_factory=dict)
    known_blueprints: List[str] = field(default_factory=list)
    # Last non-combat node outcome (rest / cache / archive), shown to the player once.
    node_event: Optional[Dict[str, Any]] = None

    def get_node(self, node_id: Optional[str]) -> Optional[MapNode]:
        return next((n for n in self.nodes if n.id == node_id), None)

    @property
    def current_node(self) -> Optional[MapNode]:
        return self.get_node(self.current_node_id)

    def reachable_node_ids(self) -> List[str]:
        node = self.current_node
        return list(node.next_ids) if node else []

    def living_heroes(self) -> List[LaneUnit]:
        return [h for h in self.heroes if h.is_alive]

    def reserve_troops(self) -> List[LaneUnit]:
        return [t for t in self.troops if t.is_alive and t.deployed_lane is None]

    def field_troops(self) -> List[LaneUnit]:
        return [t for t in self.troops if t.is_alive and t.deployed_lane is not None]

    @property
    def live_mana(self) -> int:
        b = self.battle
        return b.mana if b and b.status == BattleStatus.IN_PROGRESS else self.mana

    @property
    def is_finished(self) -> bool:
        return self.status in (RunStatus.VICTORY, RunStatus.DEFEAT, RunStatus.ABANDONED)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "biome_id": self.biome_id,
            "biome_name": self.biome_name,
            "squad_id": self.squad_id,
            "difficulty": self.difficulty,
            "mode": self.mode,
            "boss_id": self.boss_id,
            "influence": {
                "target_id": self.influence_target_id,
                "target_name": self.influence_target_name,
                "gained": self.influence_gained,
                "banked": self.influence_banked,
            } if self.influence_target_id else None,
            "hierarchy_result": self.hierarchy_result,
            "status": self.status.value,
            "nodes": [n.to_dict() for n in self.nodes],
            "current_node_id": self.current_node_id,
            "reachable_node_ids": self.reachable_node_ids() if self.status == RunStatus.MAP else [],
            "heroes": [h.to_dict() for h in self.heroes],
            "troops": [t.to_dict() for t in self.troops],
            "mana": self.live_mana,
            "mana_cap": MANA_CAP,
            "mana_floor": MANA_FLOOR,
            "battle": self.battle.to_dict() if self.battle else None,
            "log": self.log[-30:],
            "rewards": self.rewards,
            "payout": self.payout,
            "hero_names": self.hero_pool,
            "node_event": self.node_event,
            "rewards_paid": self.rewards_paid,
        }
