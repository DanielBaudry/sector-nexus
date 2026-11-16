from dataclasses import dataclass
from typing import Dict, Any
from src.domain.value_objects.enums import GambitCondition


@dataclass
class GambitRule:
    priority: int  # 1 is highest priority evaluated first
    condition: GambitCondition
    card_id: str  # Card to execute if condition is met

    def to_dict(self) -> Dict[str, Any]:
        return {
            "priority": self.priority,
            "condition": self.condition.value if hasattr(self.condition, "value") else str(self.condition),
            "card_id": self.card_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GambitRule":
        cond = data.get("condition", "always")
        if isinstance(cond, str):
            try:
                condition_enum = GambitCondition(cond)
            except ValueError:
                condition_enum = GambitCondition.ALWAYS
        else:
            condition_enum = cond

        return cls(
            priority=int(data.get("priority", 1)),
            condition=condition_enum,
            card_id=str(data.get("card_id", "basic_attack")),
        )
