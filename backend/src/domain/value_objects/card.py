from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from src.domain.value_objects.enums import TargetType, LaneScope
from src.domain.value_objects.status_effect import EffectSpec


@dataclass
class CombatCard:
    id: str
    name: str
    description: str
    energy_cost: int
    target_type: TargetType
    power_multiplier: float  # multiplier of Champion ATK
    heal_multiplier: float = 0.0  # multiplier of Champion ATK or Max HP
    shield_grant: int = 0
    cooldown_turns: int = 0
    icon_name: str = "Zap"
    flavor_quote: Optional[str] = None
    # Lane battle: which lanes the ability reaches (troops never leave their lane).
    lane_scope: LaneScope = LaneScope.SAME_LANE
    # Lane battle: optional troop template summoned into the target lane.
    summon_troop_id: Optional[str] = None
    # Lane battle (heroes): mana granted to the player when the ability is used.
    mana_gain: int = 0
    # Lane battle: buffs / debuffs / cleanse / strip / steal applied by the ability.
    effects: List[EffectSpec] = field(default_factory=list)
    # Boss abilities: own turns spent winding up (announced to the player) before it lands,
    # and the boss phase (0-based) from which the ability is unlocked.
    telegraph_turns: int = 0
    phase: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "energy_cost": self.energy_cost,
            "target_type": self.target_type.value if hasattr(self.target_type, "value") else str(self.target_type),
            "power_multiplier": self.power_multiplier,
            "heal_multiplier": self.heal_multiplier,
            "shield_grant": self.shield_grant,
            "cooldown_turns": self.cooldown_turns,
            "icon_name": self.icon_name,
            "flavor_quote": self.flavor_quote,
            "lane_scope": self.lane_scope.value if hasattr(self.lane_scope, "value") else str(self.lane_scope),
            "summon_troop_id": self.summon_troop_id,
            "mana_gain": self.mana_gain,
            "effects": [e.to_dict() for e in self.effects],
            "telegraph_turns": self.telegraph_turns,
            "phase": self.phase,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CombatCard":
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            energy_cost=data.get("energy_cost", 1),
            target_type=TargetType(data.get("target_type", TargetType.SINGLE_ENEMY)),
            power_multiplier=float(data.get("power_multiplier", 1.0)),
            heal_multiplier=float(data.get("heal_multiplier", 0.0)),
            shield_grant=int(data.get("shield_grant", 0)),
            cooldown_turns=int(data.get("cooldown_turns", 0)),
            icon_name=data.get("icon_name", "Zap"),
            flavor_quote=data.get("flavor_quote"),
            lane_scope=LaneScope(data.get("lane_scope", LaneScope.SAME_LANE)),
            summon_troop_id=data.get("summon_troop_id"),
            mana_gain=int(data.get("mana_gain", 0)),
            effects=[EffectSpec.from_dict(e) for e in data.get("effects", [])],
            telegraph_turns=int(data.get("telegraph_turns", 0)),
            phase=int(data.get("phase", 0)),
        )
