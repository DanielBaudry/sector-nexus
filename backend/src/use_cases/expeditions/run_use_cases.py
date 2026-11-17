"""Application workflows for lane-battle expedition runs (node map + 3-lane battles)."""
import copy
import uuid
from typing import Any, Dict, List, Optional, Tuple

from src.domain.entities.artifact import Artifact
from src.domain.entities.battle import LaneUnit
from src.domain.entities.expedition_run import ExpeditionRun, MapNode
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.repositories.hero_kit_repository import IHeroKitRepository
from src.domain.repositories.hierarchy_repository import IHierarchyRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.services.expedition_run_service import ExpeditionRunService
from src.domain.services.hierarchy_service import HierarchyService
from src.domain.entities.hierarchy_standing import ChampionStatus
from src.domain.services.map_generator import MapGenerator
from src.domain.value_objects.enums import NodeType, RunStatus, Side, UnitKind

TROOPS_PER_HERO = 2
MAX_HEROES = 3


def _enum_value(v: Any) -> str:
    return v.value if hasattr(v, "value") else str(v)


class _RunUseCase:
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        player_repo: Optional[IPlayerRepository] = None,
        artifact_repo: Optional[IArtifactRepository] = None,
        hierarchy_repo: Optional[IHierarchyRepository] = None,
    ):
        self.expedition_repo = expedition_repo
        self.player_repo = player_repo
        self.artifact_repo = artifact_repo
        self.hierarchy_repo = hierarchy_repo
        self.service = ExpeditionRunService()

    def _require_run(self) -> ExpeditionRun:
        run = self.expedition_repo.get_active_run()
        if not run:
            raise ValueError("No expedition run in progress.")
        return run

    def _summon_templates(self):
        return {t.id: t for t in self.expedition_repo.get_troop_templates()}

    def _save(self, run: ExpeditionRun) -> Dict[str, Any]:
        if run.is_finished and not run.rewards_paid and self.player_repo:
            payout = self.service.finalize_payout(run)
            player = self.player_repo.get_profile()
            player.credits += payout.get("credits", 0)
            player.crystals += payout.get("crystals", 0)
            player.champion_xp += payout.get("champion_xp", 0)
            self.player_repo.save_profile(player)
            if self.artifact_repo:
                for data in payout.get("artifacts", []):
                    self.artifact_repo.save(Artifact.from_dict(data))
            run.rewards_paid = True
            self._settle_hierarchy(run)
            lost = payout.get("artifacts_lost", 0)
            run.log.append(
                f"💰 Banked {payout.get('credits', 0)} CR, {payout.get('crystals', 0)} crystals, "
                f"{payout.get('champion_xp', 0)} champion XP, {len(payout.get('artifacts', []))} artifact(s)"
                + (f" ({lost} lost in extraction)." if lost else ".")
            )
        self.expedition_repo.save_active_run(run)
        return run.to_dict()

    def _settle_hierarchy(self, run: ExpeditionRun) -> None:
        """Run over: bank the expedition's Influence, or record a hierarchy boss fight's outcome."""
        if not self.hierarchy_repo:
            return
        champion_id = run.boss_id if run.mode == "boss" else run.influence_target_id
        boss = self.expedition_repo.get_boss_encounter(champion_id) if champion_id else None
        if not boss or not boss.rank:
            return
        standing = self.hierarchy_repo.get_planet(boss.planet_id, [boss.id])[0]
        if run.mode == "boss":
            result = HierarchyService.record_fight(standing, run.status == RunStatus.VICTORY)
            if result["claimed"]:
                result["rewards"] = HierarchyService.claim_rewards(boss)
                run.log.append(f"👑 {boss.name} is defeated — their seat in the hierarchy is yours.")
            else:
                a = result["adaptation"]
                run.log.append(f"🧬 {boss.name} adapts: {a['name']} — {a['description']} Your Influence is kept.")
            run.hierarchy_result = {"boss_id": boss.id, "boss_name": boss.name, **result}
        else:
            banked = HierarchyService.bank_run_influence(standing, boss, run.influence_gained, run.status)
            run.influence_banked = banked
            run.log.append(f"🎯 {banked} Influence banked on {boss.name} ({standing.influence}/{boss.influence_required}).")
        self.hierarchy_repo.save(standing)


class GetTroopCatalogUseCase:
    def __init__(self, expedition_repo: IExpeditionRepository):
        self.expedition_repo = expedition_repo

    def execute(self) -> Dict[str, Any]:
        return {
            "troops_per_hero": TROOPS_PER_HERO,
            "max_heroes": MAX_HEROES,
            "templates": [t.to_dict() for t in self.expedition_repo.get_troop_templates()],
        }


class StartExpeditionRunUseCase(_RunUseCase):
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        squad_repo: ISquadRepository,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository,
        hero_kit_repo: Optional[IHeroKitRepository] = None,
        hierarchy_repo: Optional[IHierarchyRepository] = None,
    ):
        super().__init__(expedition_repo, hierarchy_repo=hierarchy_repo)
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo
        self.hero_kit_repo = hero_kit_repo

    def _planet_state(self, planet_id: str):
        """(bosses, standings by id) for a planet's hierarchy."""
        bosses = [b for b in self.expedition_repo.get_boss_encounters() if b.rank and b.planet_id == planet_id]
        standings = (
            {s.boss_id: s for s in self.hierarchy_repo.get_planet(planet_id, [b.id for b in bosses])}
            if self.hierarchy_repo else {}
        )
        return bosses, standings

    def execute(
        self, biome_id: str, squad_id: str, troop_assignments: Optional[Dict[str, List[str]]] = None,
        difficulty: int = 1,
    ) -> Dict[str, Any]:
        current = self.expedition_repo.get_active_run()
        if current and not current.is_finished:
            raise ValueError("An expedition run is already in progress. Finish or abandon it first.")

        biome = self.expedition_repo.get_biome_by_id(biome_id)
        if not biome:
            raise ValueError(f"Biome {biome_id} not found.")
        if not 1 <= difficulty <= biome.max_difficulty:
            raise ValueError(f"{biome.name} supports difficulty 1 to {biome.max_difficulty}.")
        squad = self.squad_repo.get_by_id(squad_id)
        if not squad or not squad.champion_ids:
            raise ValueError("Invalid squad or empty squad.")

        heroes, troops = self._build_roster(squad.champion_ids, troop_assignments)
        if not heroes:
            raise ValueError("Squad has no valid heroes.")

        nodes = MapGenerator(self.service.rng).generate()
        run = ExpeditionRun(
            id=f"run_{uuid.uuid4().hex[:8]}",
            biome_id=biome.id,
            biome_name=biome.name,
            squad_id=squad.id,
            status=RunStatus.MAP,
            nodes=nodes,
            current_node_id=nodes[0].id,
            heroes=heroes,
            troops=troops,
            difficulty=difficulty,
            log=[
                f"🚀 Strike team landed on {biome.name}" + (f" — difficulty {difficulty}." if biome.max_difficulty > 1 else "."),
                f"⚠️ Hazard: {biome.hazard_name} — {biome.hazard_description}",
                "🗺️ Choose your path. The apex threat waits at the end.",
            ],
        )
        bosses, standings = self._planet_state(biome.id)
        target = HierarchyService.find_target(list(standings.values()))
        boss = next((b for b in bosses if target and b.id == target.boss_id), None)
        if boss:
            run.influence_target_id = boss.id
            run.influence_target_name = boss.name
            run.target_guard = copy.deepcopy(boss.guard) or None
            run.log.append(
                f"🎯 Hunting {boss.name}, {boss.title}: every battle won builds Influence. "
                f"Their {boss.guard.get('name', 'guards')} will be waiting."
            )
        return self._save(run)

    def _build_roster(
        self, champion_ids: List[str], troop_assignments: Optional[Dict[str, List[str]]],
    ) -> Tuple[List[LaneUnit], List[LaneUnit]]:
        """Champions -> battle heroes (gear, kit, summons) plus the troop packs they lead."""
        templates = {t.id: t for t in self.expedition_repo.get_troop_templates()}
        artifacts = {a.id: a for a in self.artifact_repo.get_all()}
        troop_assignments = troop_assignments or {}

        heroes: List[LaneUnit] = []
        troops: List[LaneUnit] = []
        for champ_id in champion_ids:
            champ = self.champion_repo.get_by_id(champ_id)
            if not champ:
                continue
            eff = champ.get_effective_stats(artifacts)
            # Abilities (lane reach, effects, summons) come straight from the hero's content file.
            cards = self.hero_kit_repo.apply_to_cards(champ.cards) if self.hero_kit_repo else copy.deepcopy(champ.cards)
            faction = _enum_value(champ.faction)

            heroes.append(LaneUnit(
                id=champ.id,
                kind=UnitKind.HERO,
                side=Side.ALLY,
                name=champ.name,
                title=champ.title,
                faction=faction,
                role=_enum_value(champ.role),
                hp=eff.max_hp,
                max_hp=eff.max_hp,
                shields=eff.max_shields,
                max_shields=eff.max_shields,
                attack=eff.attack,
                defense=eff.defense,
                speed=eff.speed,
                crit_rate=eff.crit_rate,
                crit_damage=eff.crit_damage,
                accuracy=eff.accuracy,
                resistance=eff.resistance,
                passive=self.hero_kit_repo.get_passive(champ.template_id) if self.hero_kit_repo else None,
                cards=cards,
                gambits=copy.deepcopy(champ.gambits),
                avatar_color=champ.avatar_color,
            ))

            faction_templates = [t for t in templates.values() if t.faction == faction]
            if champ.id in troop_assignments:
                chosen = troop_assignments[champ.id]
            else:
                chosen = [t.id for t in faction_templates[:TROOPS_PER_HERO]]
            if len(chosen) > TROOPS_PER_HERO:
                raise ValueError(f"{champ.name} can lead at most {TROOPS_PER_HERO} troop packs.")
            for template_id in chosen:
                template = templates.get(template_id)
                if not template:
                    raise ValueError(f"Unknown troop type {template_id}.")
                if template.faction != faction:
                    raise ValueError(f"{champ.name} cannot command {template.name} ({template.faction}).")
                troops.append(LaneUnit.troop_from_template(
                    unit_id=f"tr_{uuid.uuid4().hex[:6]}", template=template, side=Side.ALLY, owner_id=champ.id,
                ))

        return heroes, troops


class StartBossEncounterUseCase(StartExpeditionRunUseCase):
    """A single boss fight: up to three heroes (and their troops) against a colossal boss."""

    def execute(
        self, boss_id: str, champion_ids: List[str], troop_assignments: Optional[Dict[str, List[str]]] = None,
        difficulty: int = 1,
    ) -> Dict[str, Any]:
        current = self.expedition_repo.get_active_run()
        if current and not current.is_finished:
            raise ValueError("An expedition run is already in progress. Finish or abandon it first.")
        boss = self.expedition_repo.get_boss_encounter(boss_id)
        if not boss:
            raise ValueError(f"Boss {boss_id} not found.")
        if not 1 <= difficulty <= boss.max_difficulty:
            raise ValueError(f"{boss.name} supports difficulty 1 to {boss.max_difficulty}.")
        ids = list(dict.fromkeys(champion_ids))
        if not 1 <= len(ids) <= MAX_HEROES:
            raise ValueError(f"Bring between 1 and {MAX_HEROES} heroes.")
        biome = self.expedition_repo.get_biome_by_id(boss.arena_biome_id)
        if not biome:
            raise ValueError(f"Arena {boss.arena_biome_id} not found.")
        adaptations = []
        if boss.rank:
            bosses, standings = self._planet_state(boss.planet_id)
            standing = standings[boss.id]
            status = HierarchyService.status(boss, standing, bosses, standings)
            if status != ChampionStatus.VULNERABLE:
                raise ValueError(
                    f"{boss.name} is not vulnerable yet ({status.value.lower()}): "
                    + ("already defeated." if status == ChampionStatus.DEFEATED
                       else HierarchyService.unlock_hint(boss, bosses) if status == ChampionStatus.LOCKED
                       else f"gather Influence {standing.influence}/{boss.influence_required}.")
                )
            adaptations = HierarchyService.adaptations(standing.losses)
            boss = HierarchyService.adapted(boss, standing.losses)

        heroes, troops = self._build_roster(ids, troop_assignments or {})
        if not heroes:
            raise ValueError("No valid heroes selected.")

        node = MapNode(id="boss", row=0, col=1, type=NodeType.BOSS, visited=True, threat=3,
                       objective_hint=f"Slay {boss.name}")
        battle = self.service.encounters.build_boss(boss, biome, node, difficulty)
        battle.summon_templates.update({**self._summon_templates(), **battle.summon_templates})
        run = ExpeditionRun(
            id=f"run_{uuid.uuid4().hex[:8]}",
            biome_id=biome.id,
            biome_name=f"{boss.name} — {boss.title}",
            squad_id="",
            status=RunStatus.DEPLOYMENT,
            nodes=[node],
            current_node_id=node.id,
            heroes=heroes,
            troops=troops,
            battle=battle,
            difficulty=difficulty,
            mode="boss",
            boss_id=boss.id,
            log=[
                f"🐉 Boss encounter: {boss.name}, {boss.title} — difficulty {difficulty}.",
                "🎯 One hero per lane. The boss stands in every lane: all of them can hit it, and it can hit all of them.",
                *[f"🧬 Adapted from past victories: {a['name']} — {a['description']}" for a in adaptations],
            ],
        )
        return self._save(run)


class GetPlanetHierarchyUseCase:
    def __init__(self, expedition_repo: IExpeditionRepository, hierarchy_repo: IHierarchyRepository):
        self.expedition_repo = expedition_repo
        self.hierarchy_repo = hierarchy_repo

    def execute(self, planet_id: str) -> Dict[str, Any]:
        if not self.expedition_repo.get_biome_by_id(planet_id):
            raise ValueError(f"Planet {planet_id} not found.")
        bosses = [b for b in self.expedition_repo.get_boss_encounters() if b.rank and b.planet_id == planet_id]
        standings = {s.boss_id: s for s in self.hierarchy_repo.get_planet(planet_id, [b.id for b in bosses])}
        return {"planet_id": planet_id, **HierarchyService.planet_view(bosses, standings)}


class SetHierarchyTargetUseCase(GetPlanetHierarchyUseCase):
    def execute(self, boss_id: str) -> Dict[str, Any]:  # type: ignore[override]
        boss = self.expedition_repo.get_boss_encounter(boss_id)
        if not boss or not boss.rank:
            raise ValueError(f"Champion {boss_id} not found in any hierarchy.")
        bosses = [b for b in self.expedition_repo.get_boss_encounters() if b.rank and b.planet_id == boss.planet_id]
        standings = {s.boss_id: s for s in self.hierarchy_repo.get_planet(boss.planet_id, [b.id for b in bosses])}
        for changed in HierarchyService.set_target(boss, bosses, standings):
            self.hierarchy_repo.save(changed)
        return super().execute(boss.planet_id)


class GetActiveRunUseCase(_RunUseCase):
    def execute(self) -> Optional[Dict[str, Any]]:
        run = self.expedition_repo.get_active_run()
        return run.to_dict() if run else None


class ChooseRunNodeUseCase(_RunUseCase):
    def execute(self, node_id: str) -> Dict[str, Any]:
        run = self._require_run()
        biome = self.expedition_repo.get_biome_by_id(run.biome_id)
        self.service.choose_node(run, biome, node_id, self._summon_templates())
        return self._save(run)


class DeployHeroesUseCase(_RunUseCase):
    def execute(self, assignments: Dict[str, int]) -> Dict[str, Any]:
        run = self._require_run()
        self.service.deploy(run, assignments)
        return self._save(run)


class PlayHeroAbilityUseCase(_RunUseCase):
    def execute(
        self, card_id: Optional[str], target_lane: Optional[int], target_unit_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        run = self._require_run()
        self.service.play(run, card_id, target_lane, target_unit_id=target_unit_id)
        return self._save(run)


class TickRunUseCase(_RunUseCase):
    def execute(self) -> Optional[Dict[str, Any]]:
        run = self.expedition_repo.get_active_run()
        if not run:
            return None
        self.service.tick(run)
        return self._save(run)


class AbandonRunUseCase(_RunUseCase):
    def execute(self) -> Dict[str, Any]:
        run = self._require_run()
        self.service.abandon(run)
        return self._save(run)


class DismissRunUseCase(_RunUseCase):
    """Clears a finished run so a new expedition can start."""
    def execute(self) -> None:
        run = self.expedition_repo.get_active_run()
        if run and not run.is_finished:
            raise ValueError("Run still in progress — abandon it first.")
        self.expedition_repo.save_active_run(None)
