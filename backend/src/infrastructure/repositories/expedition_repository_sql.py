from typing import List, Optional, Dict
import copy
from sqlmodel import Session, select
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.entities.expedition import ActiveExpedition, BackgroundExpedition
from src.domain.entities.biome import Biome
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import LaneScope
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.database.models.sql_models import BackgroundExpeditionSQL
from src.infrastructure.database.seed_data import (
    get_seed_biomes,
    get_seed_troop_templates,
    get_seed_ability_lane_scopes,
    get_seed_summon_abilities,
)

# In-memory storage for active interactive combat sessions
_active_expedition_store: Optional[ActiveExpedition] = None
# In-memory storage for the lane-battle expedition run
_active_run_store: Optional[ExpeditionRun] = None


class ExpeditionRepositorySQL(IExpeditionRepository):
    def __init__(self, session: Session):
        self.session = session
        self._biomes = {b.id: b for b in get_seed_biomes()}

    def get_biomes(self) -> List[Biome]:
        return list(self._biomes.values())

    def get_biome_by_id(self, biome_id: str) -> Optional[Biome]:
        return self._biomes.get(biome_id)

    def get_active_expedition(self) -> Optional[ActiveExpedition]:
        global _active_expedition_store
        return _active_expedition_store

    def save_active_expedition(self, expedition: Optional[ActiveExpedition]) -> None:
        global _active_expedition_store
        _active_expedition_store = expedition

    def get_background_expeditions(self) -> List[BackgroundExpedition]:
        rows = self.session.exec(select(BackgroundExpeditionSQL)).all()
        return [
            BackgroundExpedition(
                id=r.id,
                biome_id=r.biome_id,
                biome_name=r.biome_name,
                squad_id=r.squad_id,
                squad_name=r.squad_name,
                start_time=r.start_time,
                duration_seconds=r.duration_seconds,
                claimed=r.claimed,
                reward_preview=r.reward_preview or {},
            )
            for r in rows
        ]

    def get_background_expedition_by_id(self, expedition_id: str) -> Optional[BackgroundExpedition]:
        row = self.session.get(BackgroundExpeditionSQL, expedition_id)
        if not row:
            return None
        return BackgroundExpedition(
            id=row.id,
            biome_id=row.biome_id,
            biome_name=row.biome_name,
            squad_id=row.squad_id,
            squad_name=row.squad_name,
            start_time=row.start_time,
            duration_seconds=row.duration_seconds,
            claimed=row.claimed,
            reward_preview=row.reward_preview or {},
        )

    def save_background_expedition(self, expedition: BackgroundExpedition) -> BackgroundExpedition:
        row = self.session.get(BackgroundExpeditionSQL, expedition.id)
        if row:
            row.biome_id = expedition.biome_id
            row.biome_name = expedition.biome_name
            row.squad_id = expedition.squad_id
            row.squad_name = expedition.squad_name
            row.start_time = expedition.start_time
            row.duration_seconds = expedition.duration_seconds
            row.claimed = expedition.claimed
            row.reward_preview = expedition.reward_preview
        else:
            row = BackgroundExpeditionSQL(
                id=expedition.id,
                biome_id=expedition.biome_id,
                biome_name=expedition.biome_name,
                squad_id=expedition.squad_id,
                squad_name=expedition.squad_name,
                start_time=expedition.start_time,
                duration_seconds=expedition.duration_seconds,
                claimed=expedition.claimed,
                reward_preview=expedition.reward_preview,
            )
            self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return expedition

    # ── Lane battle expedition runs ─────────────────────────────────────────
    def get_active_run(self) -> Optional[ExpeditionRun]:
        return _active_run_store

    def save_active_run(self, run: Optional[ExpeditionRun]) -> None:
        global _active_run_store
        _active_run_store = run

    def get_troop_templates(self) -> List[TroopTemplate]:
        return get_seed_troop_templates()

    def get_ability_lane_scopes(self) -> Dict[str, LaneScope]:
        return get_seed_ability_lane_scopes()

    def get_summon_abilities(self, champion_template_id: str) -> List[CombatCard]:
        return copy.deepcopy(get_seed_summon_abilities().get(champion_template_id, []))
