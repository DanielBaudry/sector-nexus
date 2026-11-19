"""
Barracks rules: research techs, train troop packs, and move packs between the
garrison and an expedition. StarCraft-style: structures unlock production,
researches give permanent bonuses to every pack of their faction.
"""
from collections import Counter
from typing import Dict, Iterable, List

from src.domain.entities.battle import LaneUnit
from src.domain.entities.player import PlayerProfile
from src.domain.entities.troop_forces import TroopForces
from src.domain.value_objects.troop import TroopTemplate
from src.domain.value_objects.upgrade import BONUS_STATS, Upgrade

MAX_TRAIN_BATCH = 10


class BarracksService:
    @staticmethod
    def missing(requires: Iterable[str], forces: TroopForces) -> List[str]:
        return [r for r in requires if r not in forces.researched]

    @staticmethod
    def _pay(profile: PlayerProfile, credits: int, crystals: int, what: str) -> None:
        if profile.credits < credits or profile.crystals < crystals:
            raise ValueError(
                f"Not enough resources for {what}: needs {credits} credits and {crystals} crystals."
            )
        profile.credits -= credits
        profile.crystals -= crystals

    def research(self, profile: PlayerProfile, forces: TroopForces, upgrade: Upgrade, names: Dict[str, str]) -> None:
        if upgrade.id in forces.researched:
            raise ValueError(f"{upgrade.name} is already complete.")
        missing = self.missing(upgrade.requires, forces)
        if missing:
            raise ValueError(f"{upgrade.name} requires {', '.join(names.get(m, m) for m in missing)}.")
        self._pay(profile, upgrade.cost_credits, upgrade.cost_crystals, upgrade.name)
        forces.researched.add(upgrade.id)

    def train(
        self, profile: PlayerProfile, forces: TroopForces, template: TroopTemplate, quantity: int, names: Dict[str, str],
    ) -> None:
        if not 1 <= quantity <= MAX_TRAIN_BATCH:
            raise ValueError(f"Train between 1 and {MAX_TRAIN_BATCH} packs at once.")
        missing = self.missing(template.requires, forces)
        if missing:
            raise ValueError(f"{template.name} requires {', '.join(names.get(m, m) for m in missing)}.")
        self._pay(profile, template.cost_credits * quantity, template.cost_crystals * quantity,
                  f"{quantity}× {template.name}")
        forces.stock[template.id] = forces.available(template.id) + quantity

    # ── Expeditions ─────────────────────────────────────────────────────────
    @staticmethod
    def take(forces: TroopForces, template_ids: List[str], names: Dict[str, str]) -> None:
        """Packs leave the garrison for an expedition."""
        for template_id, n in Counter(template_ids).items():
            if forces.available(template_id) < n:
                raise ValueError(
                    f"Only {forces.available(template_id)} {names.get(template_id, template_id)} pack(s) in the garrison."
                )
        for template_id in template_ids:
            forces.stock[template_id] -= 1

    @staticmethod
    def give_back(forces: TroopForces, packs: Iterable[LaneUnit]) -> int:
        """Surviving packs return to the garrison (regrouped to full strength)."""
        n = 0
        for pack in packs:
            if pack.is_alive and pack.template_id:
                forces.stock[pack.template_id] = forces.available(pack.template_id) + 1
                n += 1
        return n

    # ── Research bonuses ────────────────────────────────────────────────────
    @staticmethod
    def faction_bonus(faction: str, forces: TroopForces, upgrades: Iterable[Upgrade]) -> Dict[str, float]:
        bonus = {s: 0.0 for s in BONUS_STATS}
        for u in upgrades:
            if u.faction == faction and u.id in forces.researched:
                for stat, pct in u.bonus.items():
                    bonus[stat] = bonus.get(stat, 0.0) + pct
        return bonus

    @staticmethod
    def apply_bonus(pack: LaneUnit, bonus: Dict[str, float]) -> None:
        if bonus.get("attack"):
            pack.unit_attack = max(1, round(pack.unit_attack * (1 + bonus["attack"])))
            pack.attack = pack.unit_attack
        if bonus.get("hp"):
            soldiers = pack.max_count
            pack.unit_hp = max(1, round(pack.unit_hp * (1 + bonus["hp"])))
            pack.max_hp = pack.hp = pack.unit_hp * soldiers
        if bonus.get("defense"):
            pack.defense = round(pack.defense * (1 + bonus["defense"]))

    @staticmethod
    def boosted_stats(template: TroopTemplate, bonus: Dict[str, float]) -> Dict[str, int]:
        unit_hp = max(1, round(template.unit_hp * (1 + bonus.get("hp", 0))))
        unit_attack = max(1, round(template.unit_attack * (1 + bonus.get("attack", 0))))
        return {
            "count": template.count,
            "unit_hp": unit_hp,
            "unit_attack": unit_attack,
            "hp": unit_hp * template.count,
            "volley": unit_attack * template.count,
            "defense": round(template.defense * (1 + bonus.get("defense", 0))),
        }
