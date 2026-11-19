import random
from typing import Any, Dict, Optional

from src.domain.entities.battle import LANE_COUNT, LANE_NAMES, MANA_CAP, MANA_FLOOR
from src.domain.entities.biome import Biome
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.services.encounter_factory import EncounterFactory
from src.domain.services.hierarchy_service import HierarchyService
from src.domain.services.lane_battle_engine import LaneBattleEngine
from src.domain.services.loot_service import LootService
from src.domain.services.warp_forge_service import WarpForgeService
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.enums import BattleStatus, NodeType, RunStatus, Side
from src.domain.value_objects.troop import TroopTemplate

BATTLE_NODES = (NodeType.COMBAT, NodeType.ELITE, NodeType.BOSS)
REST_HERO_HEAL = 0.35      # fraction of max HP restored to living heroes
REST_TROOP_REGROUP = 0.50  # fraction of missing soldiers recovered
CACHE_MANA = 2             # supply caches hold mana crystals
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
        self.forge = WarpForgeService(self.rng)

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
            battle = self.encounters.build(biome, node, run.difficulty, guard=run.target_guard)
            battle.summon_templates.update(summon_templates)
            run.battle = battle
            run.status = RunStatus.DEPLOYMENT
            run.log.append(f"⚔️ Contact! {node.type.value} at {node.id}. Deploy your heroes to the lanes.")
        elif node.type == NodeType.REST:
            healed, regrouped = [], []
            for hero in run.living_heroes():
                before = hero.hp
                hero.hp = min(hero.max_hp, hero.hp + int(hero.max_hp * REST_HERO_HEAL))
                hero.shields = hero.max_shields
                healed.append({"id": hero.id, "name": hero.name, "before": before, "after": hero.hp, "max": hero.max_hp})
            for pack in run.troops:
                if pack.is_alive:
                    before = pack.count
                    missing = pack.max_hp - pack.hp
                    pack.hp += int(missing * REST_TROOP_REGROUP)
                    regrouped.append({"id": pack.id, "name": pack.name, "before": before, "after": pack.count, "max": pack.max_count})
            run.log.append("⛺ Field camp: heroes patched up, troops regrouped.")
            self._node_event(run, node, "Field Camp",
                             "Your squad digs in for a few hours. Medics patch the heroes up and shattered packs regroup.",
                             healed=healed, regrouped=regrouped)
        elif node.type == NodeType.ARCHIVE:
            loot = self.forge.archive_loot(run.hero_pool, self._known_blueprints(run))
            self._add_rewards(run, loot)
            run.log.append(
                f"🛰️ Derelict warp archive: {self._describe_hero_loot(run, loot)}." if loot
                else "🛰️ Derelict warp archive: the data cores are scrambled. Nothing to recover."
            )
            self._node_event(run, node, "Derelict Warp Archive",
                             "A dead relay station still hums with warp data. Your techs pull what they can from its cores."
                             if loot else "The data cores are scrambled — nothing could be recovered.",
                             loot=loot)
        elif node.type == NodeType.CACHE:
            mult = Difficulty(run.difficulty).reward_mult
            loot = {
                "credits": int(self.rng.randint(200, 450) * mult),
                "crystals": int(self.rng.randint(10, 30) * mult),
                **LootService(self.rng).node_loot(biome, node.type, node.threat, run.difficulty),
            }
            self._add_rewards(run, loot)
            run.mana = min(MANA_CAP, run.mana + CACHE_MANA)
            found = f", {len(loot['artifacts'])} artifact(s)" if loot["artifacts"] else ""
            run.log.append(
                f"📦 Supply cache: +{loot['credits']} CR, +{loot['crystals']} crystals, +{loot['champion_xp']} XP{found}, +{CACHE_MANA} mana."
            )
            self._node_event(run, node, "Supply Cache",
                             "An abandoned supply drop, still sealed. Your squad cracks it open.",
                             loot=loot, mana=CACHE_MANA)

    @staticmethod
    def _node_event(run: ExpeditionRun, node, title: str, description: str, **details: Any) -> None:
        """What happened at a non-combat node, for the client to show (seq makes each one unique)."""
        seq = (run.node_event or {}).get("seq", 0) + 1
        run.node_event = {"seq": seq, "node_id": node.id, "type": node.type.value, "title": title,
                          "description": description, **details}

    def _known_blueprints(self, run: ExpeditionRun) -> set:
        return set(run.known_blueprints) | set(run.rewards.get("blueprints", []))

    def _describe_hero_loot(self, run: ExpeditionRun, loot: Dict[str, Any]) -> str:
        parts = [f"📐 {run.hero_pool.get(t, t)} blueprint" for t in loot.get("blueprints", [])]
        parts += [f"+{n} {run.hero_pool.get(t, t)} print materials" for t, n in (loot.get("hero_materials") or {}).items()]
        return ", ".join(parts)

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
            hero.effects = []
            hero.passive_stacks = 0
            hero.shields = hero.max_shields  # shields recharge between battles; hull damage persists
            if lane is not None:
                battle.units.append(hero)
        # Packs deployed in earlier battles hold their lane.
        for pack in run.field_troops():
            pack.lane = pack.deployed_lane
            battle.units.append(pack)

        deployed = ", ".join(f"{living[h].name} → {LANE_NAMES[l]}" for h, l in assignments.items())
        battle.log.append(f"🚀 Deployment: {deployed}.")
        battle.mana = min(battle.mana_cap, max(run.mana, MANA_FLOOR))
        battle.log.append(f"🔷 {battle.mana} mana available — deploy reserve troops during your turns.")
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

    def deploy_troop(self, run: ExpeditionRun, troop_id: str, lane: int) -> None:
        """Spend mana to bring a reserve pack onto the field (player's turn only, free action)."""
        battle = run.battle
        if run.status != RunStatus.BATTLE or not battle or battle.status != BattleStatus.IN_PROGRESS:
            raise ValueError("No battle in progress.")
        if not battle.current_actor_id:
            raise ValueError("Troops can only be deployed during your turn.")
        if not (0 <= lane < LANE_COUNT):
            raise ValueError(f"Invalid lane {lane}.")
        pack = next((t for t in run.reserve_troops() if t.id == troop_id), None)
        if pack is None:
            raise ValueError("That troop pack is not in your reserve.")
        battle.spend_mana(pack.mana_cost, "deploy", pack.id)
        pack.lane = lane
        pack.deployed_lane = lane
        pack.turn_meter = 0.0
        pack.effects = []
        battle.units.append(pack)
        battle.emit("summon", source_id=None, unit_id=pack.id, lane=lane, name=pack.name, deploy=True)
        battle.log.append(f"📦 {pack.name} ×{pack.count} deployed to {LANE_NAMES[lane]} (-{pack.mana_cost} mana).")

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
        self.finalize_payout(run)

    # ── Rewards ─────────────────────────────────────────────────────────────
    def finalize_payout(self, run: ExpeditionRun) -> Dict[str, Any]:
        """
        Loot banked when the run ends: everything on victory, half otherwise
        (currencies halved, a random half of the artifacts kept, rounded up).
        Computed once so the client and the bank always agree.
        """
        if run.payout is not None:
            return run.payout
        full = run.status == RunStatus.VICTORY
        share = 1.0 if full else DEFEAT_REWARD_SHARE
        payout: Dict[str, Any] = {
            k: int(v * share) for k, v in run.rewards.items() if isinstance(v, (int, float))
        }
        artifacts = list(run.rewards.get("artifacts", []))
        if not full and artifacts:
            keep = -(-len(artifacts) // 2)  # ceil
            artifacts = self.rng.sample(artifacts, keep)
        payout["artifacts"] = artifacts
        # Warp Beacon loot: materials share like currencies; on defeat a random half of the blueprints survives.
        payout["hero_materials"] = {
            t: int(n * share) for t, n in (run.rewards.get("hero_materials") or {}).items() if int(n * share) > 0
        }
        blueprints = list(run.rewards.get("blueprints", []))
        if not full and blueprints:
            blueprints = self.rng.sample(blueprints, -(-len(blueprints) // 2))
        payout["blueprints"] = blueprints
        payout["artifacts_lost"] = len(run.rewards.get("artifacts", [])) - len(artifacts)
        run.payout = payout
        return payout

    # ── Internals ───────────────────────────────────────────────────────────
    def _settle(self, run: ExpeditionRun) -> None:
        battle = run.battle
        if not battle or battle.status not in (BattleStatus.WON, BattleStatus.LOST):
            return
        if run.status != RunStatus.BATTLE:
            return
        node = run.current_node
        if battle.status == BattleStatus.WON:
            if node and node.type == NodeType.BOSS:
                hero_loot = self.forge.boss_loot(run.hero_pool, self._known_blueprints(run))
                battle.rewards.update(hero_loot)
                if hero_loot:
                    run.log.append(f"🛰️ Warp data recovered from the wreck: {self._describe_hero_loot(run, hero_loot)}.")
            self._add_rewards(run, battle.rewards)
            drops = len(battle.rewards.get("artifacts", []))
            run.log.append(
                f"🎁 Loot: +{battle.rewards.get('credits', 0)} CR, +{battle.rewards.get('champion_xp', 0)} XP"
                + (f", {drops} artifact(s)" if drops else "") + "."
            )
            if run.influence_target_id and node:
                gained = HierarchyService.node_influence(node.type, run.difficulty)
                run.influence_gained += gained
                run.log.append(f"🎯 +{gained} Influence on {run.influence_target_name} (banked when the run ends).")
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
        if run.is_finished:
            self.finalize_payout(run)

    def _cleanup_after_battle(self, run: ExpeditionRun) -> None:
        if run.battle and run.battle.status != BattleStatus.DEPLOYMENT:
            run.mana = run.battle.mana  # unspent and earned mana carries over
        # Summoned packs dissolve; destroyed packs are gone for the rest of the run.
        roster_ids = {t.id for t in run.troops}
        run.troops = [t for t in run.troops if t.is_alive]
        for unit in run.heroes + run.troops:
            unit.lane = None
            unit.turn_meter = 0.0
            unit.effects = []      # buffs / debuffs never carry over between nodes
            unit.passive_stacks = 0
        if run.battle:
            for unit in run.battle.units:
                if unit.side == Side.ALLY and unit.is_troop and unit.id not in roster_ids:
                    unit.is_alive = False

    @staticmethod
    def _add_rewards(run: ExpeditionRun, loot: Dict[str, Any]) -> None:
        for key, value in loot.items():
            if isinstance(value, list):
                run.rewards.setdefault(key, []).extend(value)
            elif isinstance(value, dict):
                bucket = run.rewards.setdefault(key, {})
                for k, v in value.items():
                    bucket[k] = bucket.get(k, 0) + v
            else:
                run.rewards[key] = run.rewards.get(key, 0) + value
