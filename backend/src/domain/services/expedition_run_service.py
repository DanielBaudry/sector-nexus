import random
from typing import Dict, Optional

from src.domain.entities.battle import LANE_COUNT, LANE_NAMES
from src.domain.entities.biome import Biome
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.services.encounter_factory import EncounterFactory
from src.domain.services.lane_battle_engine import LaneBattleEngine
from src.domain.value_objects.enums import BattleStatus, NodeType, RunStatus, Side
from src.domain.value_objects.troop import TroopTemplate

BATTLE_NODES = (NodeType.COMBAT, NodeType.ELITE, NodeType.BOSS)
REST_HERO_HEAL = 0.35      # fraction of max HP restored to living heroes
REST_TROOP_REGROUP = 0.50  # fraction of missing soldiers recovered
DEFEAT_REWARD_SHARE = 0.5  # share of run loot kept on defeat / retreat
ACTIONS_PER_STEP = 1       # enemy/drill actions resolved per tick, so each one can be animated


class ExpeditionRunService:
    """Pure run-level rules: walking the node map, deploying into battles, carrying losses forward."""

    def __init__(
        self,
        engine: Optional[LaneBattleEngine] = None,
        encounters: Optional[EncounterFactory] = None,
        rng: Optional[random.Random] = None,
    ):
        self.rng = rng or random.Random()
        self.engine = engine or LaneBattleEngine(self.rng)
        self.encounters = encounters or EncounterFactory(self.rng)

    # ── Map ─────────────────────────────────────────────────────────────────
    def choose_node(
        self, run: ExpeditionRun, biome: Biome, node_id: str, summon_templates: Dict[str, TroopTemplate],
    ) -> None:
        if run.status != RunStatus.MAP:
            raise ValueError("You can only move on the map between battles.")
        if run.battle and run.battle.status in (BattleStatus.WON, BattleStatus.LOST):
            run.battle = None  # previous battle report dismissed by moving on
        if node_id not in run.reachable_node_ids():
            raise ValueError("That node is not reachable from your position.")
        if not run.living_heroes():
            raise ValueError("No heroes left standing.")

        node = run.get_node(node_id)
        node.visited = True
        run.current_node_id = node.id

        if node.type in BATTLE_NODES:
            battle = self.encounters.build(biome, node)
            battle.summon_templates = dict(summon_templates)
            run.battle = battle
            run.status = RunStatus.DEPLOYMENT
            run.log.append(f"⚔️ Contact! {node.type.value} at {node.id}. Deploy your heroes to the lanes.")
        elif node.type == NodeType.REST:
            for hero in run.living_heroes():
                hero.hp = min(hero.max_hp, hero.hp + int(hero.max_hp * REST_HERO_HEAL))
                hero.shields = hero.max_shields
            for pack in run.troops:
                if pack.is_alive:
                    missing = pack.max_hp - pack.hp
                    pack.hp += int(missing * REST_TROOP_REGROUP)
            run.log.append("⛺ Field camp: heroes patched up, troops regrouped.")
        elif node.type == NodeType.CACHE:
            loot = {
                "credits": self.rng.randint(200, 450),
                "crystals": self.rng.randint(10, 30),
                "experience": self.rng.randint(30, 60),
            }
            self._add_rewards(run, loot)
            run.log.append(f"📦 Supply cache: +{loot['credits']} CR, +{loot['crystals']} crystals.")

    # ── Battle ──────────────────────────────────────────────────────────────
    def deploy(self, run: ExpeditionRun, assignments: Dict[str, int], now: Optional[float] = None) -> None:
        if run.status != RunStatus.DEPLOYMENT or not run.battle:
            raise ValueError("No battle awaiting deployment.")
        if not assignments:
            raise ValueError("Deploy at least one hero.")
        lanes_used = set()
        living = {h.id: h for h in run.living_heroes()}
        for hero_id, lane in assignments.items():
            if hero_id not in living:
                raise ValueError(f"Hero {hero_id} is not available.")
            if not (0 <= lane < LANE_COUNT):
                raise ValueError(f"Invalid lane {lane}.")
            if lane in lanes_used:
                raise ValueError(f"{LANE_NAMES[lane]} already has a hero (max 1 per lane).")
            lanes_used.add(lane)

        battle = run.battle
        for hero in run.heroes:
            lane = assignments.get(hero.id) if hero.is_alive else None
            hero.lane = lane
            hero.turn_meter = 0.0
            hero.cooldowns = {}
            hero.actions_taken = 0
            hero.shields = hero.max_shields  # shields recharge between battles; hull damage persists
            for pack in run.troops_of(hero.id):
                pack.lane = lane
            if lane is not None:
                battle.units.append(hero)
                battle.units.extend(run.troops_of(hero.id))

        deployed = ", ".join(f"{living[h].name} → {LANE_NAMES[l]}" for h, l in assignments.items())
        battle.log.append(f"🚀 Deployment: {deployed}.")
        run.status = RunStatus.BATTLE
        self.engine.begin(battle, now, max_actions=ACTIONS_PER_STEP)
        self._settle(run)

    def play(
        self, run: ExpeditionRun, card_id: Optional[str], target_lane: Optional[int],
        now: Optional[float] = None, target_unit_id: Optional[str] = None,
    ) -> None:
        if run.status != RunStatus.BATTLE or not run.battle:
            raise ValueError("No battle in progress.")
        self.engine.play_ally_turn(
            run.battle, card_id=card_id, target_lane=target_lane, now=now, target_unit_id=target_unit_id,
            max_actions_after=0,
        )
        self._settle(run)

    def tick(self, run: ExpeditionRun, now: Optional[float] = None) -> None:
        if run.status != RunStatus.BATTLE or not run.battle:
            return
        battle = run.battle
        if battle.current_actor_id and battle.is_turn_timed_out(now):
            self.engine.play_ally_turn(battle, timed_out=True, now=now, max_actions_after=0)
        elif not battle.current_actor_id:
            self.engine.advance(battle, now, max_actions=ACTIONS_PER_STEP)
        self._settle(run)

    def abandon(self, run: ExpeditionRun) -> None:
        if run.is_finished:
            return
        run.status = RunStatus.ABANDONED
        if run.battle:
            run.battle.current_actor_id = None
        run.log.append("🛰️ Emergency extraction called. Expedition abandoned.")
        self._cleanup_after_battle(run)

    # ── Rewards ─────────────────────────────────────────────────────────────
    @staticmethod
    def payout(run: ExpeditionRun) -> Dict[str, int]:
        """Loot banked to the player when the run ends."""
        share = 1.0 if run.status == RunStatus.VICTORY else DEFEAT_REWARD_SHARE
        return {k: int(v * share) for k, v in run.rewards.items()}

    # ── Internals ───────────────────────────────────────────────────────────
    def _settle(self, run: ExpeditionRun) -> None:
        battle = run.battle
        if not battle or battle.status not in (BattleStatus.WON, BattleStatus.LOST):
            return
        if run.status != RunStatus.BATTLE:
            return
        node = run.current_node
        if battle.status == BattleStatus.WON:
            self._add_rewards(run, battle.rewards)
            if node and node.type == NodeType.BOSS:
                run.status = RunStatus.VICTORY
                run.log.append(f"🏆 {run.biome_name} conquered!")
            elif not run.living_heroes():
                run.status = RunStatus.DEFEAT
                run.log.append("❌ Battle won, but no hero survived to lead the expedition.")
            else:
                run.status = RunStatus.MAP
                run.log.append(f"✅ Node {battle.node_id} secured. Choose your next path.")
        else:
            run.status = RunStatus.DEFEAT
            run.log.append(f"❌ Defeated at node {battle.node_id}. Expedition lost.")
        self._cleanup_after_battle(run)

    def _cleanup_after_battle(self, run: ExpeditionRun) -> None:
        # Summoned packs dissolve; destroyed packs are gone for the rest of the run.
        roster_ids = {t.id for t in run.troops}
        run.troops = [t for t in run.troops if t.is_alive]
        for unit in run.heroes + run.troops:
            unit.lane = None
            unit.turn_meter = 0.0
        if run.battle:
            for unit in run.battle.units:
                if unit.side == Side.ALLY and unit.is_troop and unit.id not in roster_ids:
                    unit.is_alive = False

    @staticmethod
    def _add_rewards(run: ExpeditionRun, loot: Dict[str, int]) -> None:
        for key, value in loot.items():
            run.rewards[key] = run.rewards.get(key, 0) + value
