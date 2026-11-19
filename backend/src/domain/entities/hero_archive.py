from dataclasses import dataclass, field
from typing import Any, Dict, Set


@dataclass
class HeroArchive:
    """Warp Beacon archive: hero blueprints found and print materials gathered per hero."""
    blueprints: Set[str] = field(default_factory=set)           # hero template ids
    materials: Dict[str, int] = field(default_factory=dict)     # hero template id -> print materials

    def materials_for(self, template_id: str) -> int:
        return self.materials.get(template_id, 0)

    def add(self, loot: Dict[str, Any]) -> None:
        """Bank expedition loot: {"blueprints": [ids], "hero_materials": {id: n}}."""
        self.blueprints.update(loot.get("blueprints", []))
        for template_id, n in (loot.get("hero_materials") or {}).items():
            self.materials[template_id] = self.materials_for(template_id) + int(n)
