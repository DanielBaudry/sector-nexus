"""
Content library: loads, validates and serves the game's design data from `backend/content/`.

- Every JSON file is validated against `content/schema.py` (unknown keys, bad values and
  broken references fail with the file name).
- Files are re-read automatically when they change (no server restart needed).
- Builders turn the validated files into domain objects; each call returns fresh copies,
  so callers may mutate them freely.
"""
import copy
import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import ValidationError

from src.domain.entities.biome import Biome
from src.domain.entities.boss_encounter import BossEncounter, HierarchyRank
from src.domain.entities.champion import Champion
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import ArtifactSetType, Faction, Rarity, Role
from src.domain.value_objects.gambit import GambitRule
from src.domain.value_objects.stats import Stats
from src.domain.value_objects.status_effect import Passive
from src.domain.value_objects.troop import TroopTemplate
from src.domain.value_objects.upgrade import Upgrade
from src.infrastructure.content import schema as cs

DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[3] / "content"


class ContentError(ValueError):
    """A content file is invalid (message names the file and the problem)."""


def content_dir() -> Path:
    return Path(os.environ.get("CONTENT_DIR", DEFAULT_CONTENT_DIR))


@dataclass
class ContentLibrary:
    heroes: Dict[str, cs.Hero]
    troops: Dict[str, cs.Troop]
    planets: Dict[str, cs.Planet]
    bosses: Dict[str, cs.Boss]
    upgrades: Dict[str, cs.Upgrade]

    # ── Loading ─────────────────────────────────────────────────────────────
    @classmethod
    def load(cls, root: Path) -> "ContentLibrary":
        loaded: Dict[str, Dict[str, object]] = {}
        for kind, model in cs.CONTENT_KINDS.items():
            items: Dict[str, object] = {}
            for path in sorted((root / kind).glob("*.json")):
                rel = path.relative_to(root)
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    item = model.model_validate(data)
                except json.JSONDecodeError as e:
                    raise ContentError(f"{rel}: invalid JSON — {e}") from e
                except ValidationError as e:
                    problems = "; ".join(
                        f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()
                    )
                    raise ContentError(f"{rel}: {problems}") from e
                key = item.id if hasattr(item, "id") else path.stem
                if key in items:
                    raise ContentError(f"{rel}: duplicate {kind[:-1]} id '{key}'.")
                items[key] = item
            if items and hasattr(next(iter(items.values())), "order"):
                items = dict(sorted(items.items(), key=lambda kv: (kv[1].order, kv[0])))
            loaded[kind] = items
        lib = cls(**loaded)  # type: ignore[arg-type]
        lib._check_references()
        return lib

    def _check_references(self) -> None:
        troop_ids = set(self.troops)
        for hero in self.heroes.values():
            ability_ids = [a.id for a in hero.abilities]
            if len(set(ability_ids)) != len(ability_ids):
                raise ContentError(f"heroes/{hero.id}: duplicate ability ids.")
            for g in hero.gambits:
                if g.card_id not in ability_ids:
                    raise ContentError(f"heroes/{hero.id}: gambit references unknown ability '{g.card_id}'.")
            for a in hero.abilities:
                if a.summon_troop_id and a.summon_troop_id not in troop_ids:
                    raise ContentError(f"heroes/{hero.id}: ability '{a.id}' summons unknown troop '{a.summon_troop_id}'.")
        for planet in self.planets.values():
            for enemy in planet.enemy_pool + planet.difficulty_enemies:
                self._check_enemy(f"planets/{planet.id}", enemy)
        for boss in self.bosses.values():
            where = f"bosses/{boss.id}"
            if boss.planet not in self.planets:
                raise ContentError(f"{where}: unknown planet '{boss.planet}'.")
            if boss.superior:
                sup = self.bosses.get(boss.superior)
                if not sup:
                    raise ContentError(f"{where}: unknown superior '{boss.superior}'.")
                if sup.planet != boss.planet:
                    raise ContentError(f"{where}: superior '{boss.superior}' is on another planet.")
            if boss.rank and boss.rank != "OVERLORD" and not boss.superior:
                raise ContentError(f"{where}: a {boss.rank.lower()} needs a superior.")
            thresholds = [p.threshold for p in boss.phases]
            if thresholds[0] != 1.0 or thresholds != sorted(thresholds, reverse=True):
                raise ContentError(f"{where}: phases must start at threshold 1.0 and go down.")
            for a in boss.abilities:
                if a.summon_troop_id and a.summon_troop_id not in boss.summons:
                    raise ContentError(f"{where}: ability '{a.id}' summons '{a.summon_troop_id}' missing from summons.")
                if a.phase >= len(boss.phases):
                    raise ContentError(f"{where}: ability '{a.id}' unlocks in phase {a.phase + 1}, boss has {len(boss.phases)}.")
            for p in boss.phases:
                for s in p.summons:
                    if s.template_id not in boss.summons:
                        raise ContentError(f"{where}: phase '{p.name}' summons '{s.template_id}' missing from summons.")
                    if any(not 0 <= lane <= 2 for lane in s.lanes):
                        raise ContentError(f"{where}: phase '{p.name}' summons into an invalid lane (0-2).")
            if boss.guard:
                self._check_enemy(where, boss.guard)
        self._check_hierarchy_cycles()
        self._check_tech_tree()

    def _check_tech_tree(self) -> None:
        for troop in self.troops.values():
            for req in troop.requires:
                up = self.upgrades.get(req)
                if not up:
                    raise ContentError(f"troops/{troop.id}: requires unknown upgrade '{req}'.")
                if up.faction != troop.faction:
                    raise ContentError(f"troops/{troop.id}: requires '{req}' from another faction.")
        for up in self.upgrades.values():
            for req in up.requires:
                if req not in self.upgrades:
                    raise ContentError(f"upgrades/{up.id}: requires unknown upgrade '{req}'.")
        for up in self.upgrades.values():  # no loops in the tech tree
            stack, seen = list(up.requires), set()
            while stack:
                cur = stack.pop()
                if cur == up.id:
                    raise ContentError(f"upgrades/{up.id}: tech tree loop.")
                if cur not in seen:
                    seen.add(cur)
                    stack.extend(self.upgrades[cur].requires)

    @staticmethod
    def _check_enemy(where: str, enemy: cs.Enemy) -> None:
        for c in enemy.cards:
            if c.summon_troop_id and c.summon_troop_id not in enemy.summons:
                raise ContentError(f"{where}: {enemy.name}'s '{c.id}' summons '{c.summon_troop_id}' missing from its summons.")

    def _check_hierarchy_cycles(self) -> None:
        for boss in self.bosses.values():
            seen, cur = set(), boss
            while cur and cur.superior:
                if cur.id in seen:
                    raise ContentError(f"bosses/{boss.id}: hierarchy loop through '{cur.id}'.")
                seen.add(cur.id)
                cur = self.bosses.get(cur.superior)

    # ── Domain builders ─────────────────────────────────────────────────────
    def champion_templates(self) -> List[Champion]:
        return [self._champion(h) for h in self.heroes.values()]

    def champion_template(self, template_id: str) -> Optional[Champion]:
        hero = self.heroes.get(template_id)
        return self._champion(hero) if hero else None

    @staticmethod
    def _champion(h: cs.Hero) -> Champion:
        s = h.stats
        return Champion(
            id=h.id,
            template_id=h.id,
            name=h.name,
            title=h.title,
            faction=Faction(h.faction),
            role=Role(h.role),
            rarity=Rarity(h.rarity),
            level=1,
            experience=0,
            base_stats=Stats(
                hp=s.hp, max_hp=s.hp, shields=s.shields, max_shields=s.shields, attack=s.attack,
                defense=s.defense, speed=s.speed, crit_rate=s.crit_rate, crit_damage=s.crit_damage,
                accuracy=s.accuracy, resistance=s.resistance,
            ),
            cards=[CombatCard.from_dict(a.model_dump(exclude={"schema_ref"})) for a in h.abilities],
            gambits=[GambitRule.from_dict(g.model_dump(exclude={"schema_ref"})) for g in h.gambits],
            avatar_color=h.avatar_color,
            avatar_icon=h.avatar_icon,
        )

    def hero_passive(self, template_id: str) -> Optional[Passive]:
        hero = self.heroes.get(template_id)
        return Passive.from_dict(_plain(hero.passive)) if hero and hero.passive else None

    def troop_templates(self) -> List[TroopTemplate]:
        out = []
        for t in self.troops.values():
            data = _plain(t)
            cost = data.pop("cost", {})
            data["requires"] = tuple(data.get("requires", []))
            out.append(TroopTemplate(**data, cost_credits=cost.get("credits", 0), cost_crystals=cost.get("crystals", 0)))
        return out

    def upgrades_list(self) -> List[Upgrade]:
        return [
            Upgrade(
                id=u.id, name=u.name, faction=u.faction, kind=u.kind, description=u.description,
                cost_credits=u.cost.credits, cost_crystals=u.cost.crystals, requires=tuple(u.requires),
                bonus={k: v for k, v in u.bonus.model_dump().items() if v}, order=u.order,
            )
            for u in self.upgrades.values()
        ]

    def biomes(self) -> List[Biome]:
        out = []
        for p in self.planets.values():
            out.append(Biome(
                id=p.id,
                name=p.name,
                description=p.description,
                hazard_name=p.hazard_name,
                hazard_description=p.hazard_description,
                recommended_power=p.recommended_power,
                allowed_artifact_sets=[ArtifactSetType(s) for s in p.allowed_artifact_sets],
                color=p.color,
                bg_gradient=p.bg_gradient,
                icon_name=p.icon_name,
                enemy_pool=[_plain(e) for e in p.enemy_pool],
                max_difficulty=p.max_difficulty,
                difficulty_enemies=[_plain(e) for e in p.difficulty_enemies],
                image=p.image,
                image_hue=p.image_hue,
                battle_image=p.battle_image,
            ))
        return out

    def boss_encounters(self) -> List[BossEncounter]:
        out = []
        for b in self.bosses.values():
            s = b.stats
            out.append(BossEncounter(
                id=b.id,
                name=b.name,
                title=b.title,
                description=b.description,
                arena_biome_id=b.planet,
                arena_name=b.arena_name,
                image=b.image,
                recommended_power=b.recommended_power,
                hp=s.hp,
                attack=s.attack,
                defense=s.defense,
                speed=s.speed,
                shields=s.shields,
                crit_rate=s.crit_rate,
                accuracy=s.accuracy,
                resistance=s.resistance,
                abilities=[_plain(a) for a in b.abilities],
                phases=[_plain(p) for p in b.phases],
                summons={k: _plain(v) for k, v in b.summons.items()},
                passive=_plain(b.passive) if b.passive else {},
                rewards=dict(b.rewards),
                max_difficulty=b.max_difficulty,
                color=b.color,
                art_hue=b.art_hue,
                rank=HierarchyRank(b.rank) if b.rank else None,
                superior_id=b.superior,
                influence_required=b.influence_required,
                guard=_plain(b.guard) if b.guard else {},
                recruit_template_id=b.recruit_template_id,
                claim_bonus=dict(b.claim_bonus),
            ))
        return out


def _plain(model) -> dict:
    """Model -> plain dict (no None values, no editor keys), as the domain's from_dict expects."""
    return model.model_dump(exclude_none=True, exclude={"schema_ref"})


# ── Cached, hot-reloading access ─────────────────────────────────────────────
_lock = threading.Lock()
_cache: Tuple[Optional[tuple], Optional[ContentLibrary]] = (None, None)


def _signature(root: Path) -> tuple:
    files = sorted(root.glob("*/*.json"))
    return tuple((str(f), f.stat().st_mtime_ns, f.stat().st_size) for f in files if f.parent.name != "schema")


def get_library() -> ContentLibrary:
    """The current content, reloaded whenever a file under content/ changes."""
    global _cache
    root = content_dir()
    sig = _signature(root)
    with _lock:
        if _cache[0] != sig or _cache[1] is None:
            _cache = (sig, ContentLibrary.load(root))
        return copy.copy(_cache[1])
