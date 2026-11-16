import copy
import random
import uuid
import time
from typing import Dict, Any, Optional, List
from src.domain.repositories.expedition_repository import IExpeditionRepository
from src.domain.repositories.squad_repository import ISquadRepository
from src.domain.repositories.champion_repository import IChampionRepository
from src.domain.repositories.artifact_repository import IArtifactRepository
from src.domain.repositories.player_repository import IPlayerRepository
from src.domain.entities.expedition import ActiveExpedition
from src.domain.services.combat_engine import CombatEngine


class StartActiveExpeditionUseCase:
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        squad_repo: ISquadRepository,
        champion_repo: IChampionRepository,
        artifact_repo: IArtifactRepository,
    ):
        self.expedition_repo = expedition_repo
        self.squad_repo = squad_repo
        self.champion_repo = champion_repo
        self.artifact_repo = artifact_repo

    def execute(self, biome_id: str, squad_id: str) -> Dict[str, Any]:
        biome = self.expedition_repo.get_biome_by_id(biome_id)
        if not biome:
            raise ValueError(f"Biome {biome_id} not found.")

        squad = self.squad_repo.get_by_id(squad_id)
        if not squad or not squad.champion_ids:
            raise ValueError("Invalid squad or empty squad.")

        artifacts = {a.id: a for a in self.artifact_repo.get_all()}

        # Build allies
        allies = []
        for c_id in squad.champion_ids:
            champ = self.champion_repo.get_by_id(c_id)
            if champ:
                eff = champ.get_effective_stats(artifacts)
                allies.append({
                    "id": champ.id,
                    "name": champ.name,
                    "title": champ.title,
                    "faction": champ.faction.value if hasattr(champ.faction, "value") else str(champ.faction),
                    "role": champ.role.value if hasattr(champ.role, "value") else str(champ.role),
                    "hp": eff.hp,
                    "max_hp": eff.max_hp,
                    "shields": eff.shields,
                    "max_shields": eff.max_shields,
                    "attack": eff.attack,
                    "defense": eff.defense,
                    "speed": eff.speed,
                    "crit_rate": eff.crit_rate,
                    "crit_damage": eff.crit_damage,
                    "cards": [c.to_dict() for c in champ.cards],
                    "gambits": [g.to_dict() for g in champ.gambits],
                    "avatar_color": champ.avatar_color,
                    "avatar_icon": champ.avatar_icon,
                    "turn_meter": 0,
                    "is_alive": True,
                })

        # Build enemies from biome pool for Room 1
        num_enemies = random.randint(2, 3)
        enemies = []
        for i in range(num_enemies):
            proto = random.choice(biome.enemy_pool)
            enemy = copy.deepcopy(proto)
            enemy["id"] = f"enemy_{uuid.uuid4().hex[:6]}"
            enemy["turn_meter"] = 0
            enemy["is_alive"] = True
            enemies.append(enemy)

        expedition = ActiveExpedition(
            id=f"exp_{uuid.uuid4().hex[:8]}",
            biome_id=biome.id,
            biome_name=biome.name,
            squad_id=squad.id,
            room_index=0,
            total_rooms=3,
            status="IN_PROGRESS",
            allies=allies,
            enemies=enemies,
            turn_time_limit_seconds=7.0,
            combat_log=[
                f"🚀 Strike Team deployed to {biome.name}!",
                f"⚠️ Planetary Hazard detected: {biome.hazard_name} - {biome.hazard_description}",
                f"⚔️ Room 1/3: {len(enemies)} hostile units engaged!"
            ]
        )

        CombatEngine.initialize_turn_meters(expedition)
        CombatEngine.step_initiative(expedition)
        self.expedition_repo.save_active_expedition(expedition)

        return expedition.to_dict()


class ExecuteTimedCardChoiceUseCase:
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        player_repo: IPlayerRepository
    ):
        self.expedition_repo = expedition_repo
        self.player_repo = player_repo

    def execute(self, card_id: Optional[str] = None) -> Dict[str, Any]:
        expedition = self.expedition_repo.get_active_expedition()
        if not expedition or expedition.status != "IN_PROGRESS":
            raise ValueError("No active expedition in progress.")

        # Check if turn is timed out
        force_timeout = expedition.is_turn_timed_out()

        CombatEngine.execute_ally_card(
            expedition=expedition,
            card_id=card_id,
            force_timeout_gambit=force_timeout
        )

        # If expedition is won or lost, claim rewards to player
        if expedition.status in ("VICTORY", "DEFEAT"):
            player = self.player_repo.get_profile()
            player.credits += expedition.accumulated_rewards.get("credits", 0)
            player.crystals += expedition.accumulated_rewards.get("crystals", 0)
            player.experience += expedition.accumulated_rewards.get("experience", 0)
            self.player_repo.save_profile(player)

        self.expedition_repo.save_active_expedition(expedition)
        return expedition.to_dict()


class TickExpeditionUseCase:
    """
    Called periodically by frontend if timer expires or to step combat.
    """
    def __init__(
        self,
        expedition_repo: IExpeditionRepository,
        player_repo: IPlayerRepository
    ):
        self.expedition_repo = expedition_repo
        self.player_repo = player_repo

    def execute(self) -> Dict[str, Any]:
        expedition = self.expedition_repo.get_active_expedition()
        if not expedition or expedition.status != "IN_PROGRESS":
            return expedition.to_dict() if expedition else {}

        # If current turn is ally and timeout passed, auto-fire gambit!
        if expedition.current_turn_entity_type == "ALLY" and expedition.is_turn_timed_out():
            CombatEngine.execute_ally_card(expedition, force_timeout_gambit=True)
        elif not expedition.current_turn_entity_type:
            # Advance initiative
            CombatEngine.step_initiative(expedition)

        # Check victory/defeat rewards
        if expedition.status in ("VICTORY", "DEFEAT"):
            player = self.player_repo.get_profile()
            player.credits += expedition.accumulated_rewards.get("credits", 0)
            player.crystals += expedition.accumulated_rewards.get("crystals", 0)
            player.experience += expedition.accumulated_rewards.get("experience", 0)
            self.player_repo.save_profile(player)

        self.expedition_repo.save_active_expedition(expedition)
        return expedition.to_dict()
