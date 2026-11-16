"""Application workflows for lane-battle expedition runs (node map + 3-lane battles)."""
import copy
import uuid
from typing import Any, Dict, List, Optional

from src.domain.entities.battle import LaneUnit
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.services.expedition_run_service import ExpeditionRunService
from src.domain.services.map_generator import MapGenerator
from src.domain.value_objects.enums import RunStatus, Side, UnitKind

TROOPS_PER_HERO = 2
MAX_HEROES = 3


def _enum_value(v: Any) -> str:
    return v.value if hasattr(v, "value") else str(v)


class _RunUseCase:
    def __init__(self, expedition_repo: IExpeditionRepository, player_repo: Optional[IPlayerRepository] = None):
        self.expedition_repo = expedition_repo
        self.player_repo = player_repo
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
            payout = ExpeditionRunService.payout(run)
            player = self.player_repo.get_profile()
            player.credits += payout.get("credits", 0)
            player.crystals += payout.get("crystals", 0)
            player.experience += payout.get("experience", 0)
            self.player_repo.save_profile(player)
            run.rewards_paid = True
            run.log.append(
                f"💰 Banked {payout.get('credits', 0)} CR, {payout.get('crystals', 0)} crystals, "
                f"{payout.get('experience', 0)} XP."
            )
        self.expedition_repo.save_active_run(run)
        return run.to_dict()


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
    ):
        super().__init__(expedition_repo)
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo

    def execute(self, biome_id: str, squad_id: str, troop_assignments: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
        current = self.expedition_repo.get_active_run()
        if current and not current.is_finished:
            raise ValueError("An expedition run is already in progress. Finish or abandon it first.")

        biome = self.expedition_repo.get_biome_by_id(biome_id)
        if not biome:
            raise ValueError(f"Biome {biome_id} not found.")
        squad = self.squad_repo.get_by_id(squad_id)
        if not squad or not squad.champion_ids:
            raise ValueError("Invalid squad or empty squad.")

        templates = {t.id: t for t in self.expedition_repo.get_troop_templates()}
        lane_scopes = self.expedition_repo.get_ability_lane_scopes()
        artifacts = {a.id: a for a in self.artifact_repo.get_all()}
        troop_assignments = troop_assignments or {}

        heroes: List[LaneUnit] = []
        troops: List[LaneUnit] = []
        for champ_id in squad.champion_ids:
            champ = self.champion_repo.get_by_id(champ_id)
            if not champ:
                continue
            eff = champ.get_effective_stats(artifacts)
            cards = copy.deepcopy(champ.cards)
            for card in cards:
                if card.id in lane_scopes:
                    card.lane_scope = lane_scopes[card.id]
            cards.extend(self.expedition_repo.get_summon_abilities(champ.template_id))
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
            log=[
                f"🚀 Strike team landed on {biome.name}.",
                f"⚠️ Hazard: {biome.hazard_name} — {biome.hazard_description}",
                "🗺️ Choose your path. The apex threat waits at the end.",
            ],
        )
        return self._save(run)


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
