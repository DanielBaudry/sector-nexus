"""
Lane Battle Engine — the 3-lane active battle mode.

Rules
-----
* 3 lanes. Each side may have at most 1 hero per lane plus any number of troop packs.
* Heroes act on ATB initiative (turn meter filled by Speed).
  - Ally hero turn: the player picks an ability (and a target lane for ANY_LANE
    abilities) within the decision window; on timeout the hero's Gambits decide.
  - Enemy hero turn: scripted AI.
* When a hero finishes its action, every troop pack of that side in the hero's
  lane fires a volley at the unit in front of it (enemy troops screen their hero).
* Lanes with troops but no living hero of that side use a slower "drill" meter
  so leaderless troops still fight.
* Troops never leave their lane. Hero abilities reach lanes according to
  their LaneScope (same / adjacent / any / all).
* Every resolved action increments `battle.turn`; scripted waves and
  SURVIVE objectives key off that counter.
"""
import random
import time
import uuid
from typing import List, Optional

from src.domain.entities.battle import LANE_COUNT, LANE_NAMES, Battle, LaneUnit
from src.domain.services.gambit_evaluator import GambitEvaluator
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import (
    BattleStatus,
    LaneScope,
    ObjectiveType,
    Side,
    TargetType,
)

METER_FULL = 100.0
METER_RATE = 0.15          # meter gained per tick = speed * rate
DRILL_SPEED = 80           # speed of leaderless troops in a lane
MAX_TICKS_PER_STEP = 500

BASIC_ATTACK = CombatCard(
    id="basic_attack",
    name="Standard Fire",
    description="Fire at the closest hostile in this lane.",
    energy_cost=0,
    target_type=TargetType.SINGLE_ENEMY,
    power_multiplier=1.0,
)


class LaneBattleEngine:
    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    # ── Lifecycle ───────────────────────────────────────────────────────────
    def begin(self, battle: Battle, now: Optional[float] = None, max_actions: Optional[int] = None) -> None:
        battle.status = BattleStatus.IN_PROGRESS
        for u in battle.units:
            if u.is_hero and u.lane is not None:
                u.turn_meter = float(self.rng.randint(10, 40))
        for side in Side:
            for lane in range(LANE_COUNT):
                battle.drill_meters[f"{side.value}:{lane}"] = float(self.rng.randint(0, 20))
        self._evaluate(battle)
        self.advance(battle, now, max_actions)

    def advance(self, battle: Battle, now: Optional[float] = None, max_actions: Optional[int] = None) -> None:
        """
        Run initiative until an ally hero needs a decision or the battle ends.
        `max_actions` caps how many enemy/drill actions resolve in this call, so the
        client can animate the battle one action at a time (None = unlimited).
        """
        ticks = 0
        actions = 0
        while battle.status == BattleStatus.IN_PROGRESS and not battle.current_actor_id:
            ticks += 1
            if ticks > MAX_TICKS_PER_STEP:
                return
            actor_key = self._next_ready(battle)
            if actor_key is None:
                self._tick_meters(battle)
                continue

            unit = None if actor_key.startswith("DRILL:") else battle.get_unit(actor_key)
            if unit is not None and unit.side == Side.ALLY:
                battle.current_actor_id = unit.id
                battle.turn_started_at = time.time() if now is None else now
                battle.log.append(f"⚡ {unit.name} ready in {LANE_NAMES[unit.lane]} — choose an ability.")
                battle.emit("ready", actor_id=unit.id, lane=unit.lane)
                return
            if max_actions is not None and actions >= max_actions:
                return
            actions += 1

            if actor_key.startswith("DRILL:"):
                _, side_value, lane_str = actor_key.split(":")
                side, lane = Side(side_value), int(lane_str)
                battle.drill_meters[f"{side.value}:{lane}"] = 0.0
                battle.emit("turn", actor_id=None, side=side.value, lane=lane, drill=True)
                self._volley(battle, side, lane)
                self._end_action(battle)
                continue

            if unit is None:
                continue
            battle.emit("turn", actor_id=unit.id, side=unit.side.value, lane=unit.lane, drill=False)
            self._enemy_hero_turn(battle, unit)
            self._end_action(battle)

    def play_ally_turn(
        self,
        battle: Battle,
        card_id: Optional[str] = None,
        target_lane: Optional[int] = None,
        timed_out: bool = False,
        now: Optional[float] = None,
        target_unit_id: Optional[str] = None,
        max_actions_after: Optional[int] = None,
    ) -> None:
        if battle.status != BattleStatus.IN_PROGRESS:
            raise ValueError("Battle is not in progress.")
        actor = battle.current_actor
        if actor is None:
            raise ValueError("No hero is waiting for orders.")
        if target_lane is not None and not (0 <= target_lane < LANE_COUNT):
            raise ValueError(f"Invalid lane {target_lane}.")

        card: Optional[CombatCard] = None
        if card_id and not timed_out:
            card = next((c for c in actor.cards if c.id == card_id), None)
            if card is None:
                raise ValueError(f"{actor.name} has no ability {card_id}.")
            if actor.cooldowns.get(card.id, 0) > 0:
                raise ValueError(f"{card.name} is still on cooldown.")
        if card is None:
            card = self._gambit_choice(battle, actor)
            target_lane = None
            target_unit_id = None
            if timed_out:
                battle.log.append(f"⏱️ Decision window expired — {actor.name} follows gambit: {card.name}.")

        target_unit = None
        if target_unit_id:
            target_unit = self._validate_unit_target(battle, actor, card, target_unit_id)
            if card.lane_scope == LaneScope.ANY_LANE:
                target_lane = target_unit.lane

        if card.lane_scope == LaneScope.ANY_LANE and target_lane is None:
            target_lane = self._auto_target_lane(battle, actor, card)

        battle.emit("turn", actor_id=actor.id, side=actor.side.value, lane=actor.lane, drill=False)
        self._tick_cooldowns(actor)
        self._resolve_ability(battle, actor, card, target_lane, target_unit)
        if card.cooldown_turns > 0:
            actor.cooldowns[card.id] = card.cooldown_turns
        actor.turn_meter = 0.0
        actor.actions_taken += 1
        battle.current_actor_id = None

        if actor.is_alive and actor.lane is not None:
            self._volley(battle, Side.ALLY, actor.lane)
        self._end_action(battle)
        self.advance(battle, now, max_actions_after)

    # ── Initiative ──────────────────────────────────────────────────────────
    def _next_ready(self, battle: Battle) -> Optional[str]:
        candidates = []
        for u in battle.units:
            if u.is_hero and u.is_alive and u.lane is not None and u.turn_meter >= METER_FULL:
                # Allies win ties so the player is never skipped.
                candidates.append((u.turn_meter, 1 if u.side == Side.ALLY else 0, u.id))
        for side in Side:
            for lane in range(LANE_COUNT):
                meter = battle.drill_meters.get(f"{side.value}:{lane}", 0.0)
                if meter >= METER_FULL and self._lane_drills(battle, side, lane):
                    candidates.append((meter, -1, f"DRILL:{side.value}:{lane}"))
        if not candidates:
            return None
        candidates.sort(reverse=True)
        return candidates[0][2]

    def _lane_drills(self, battle: Battle, side: Side, lane: int) -> bool:
        """Leaderless troops drill on their own meter."""
        has_troops = any(u.is_troop for u in battle.living(side, lane))
        return has_troops and battle.lane_hero(side, lane) is None

    def _tick_meters(self, battle: Battle) -> None:
        for u in battle.units:
            if u.is_hero and u.is_alive and u.lane is not None:
                u.turn_meter += max(5.0, u.speed * METER_RATE)
        for side in Side:
            for lane in range(LANE_COUNT):
                key = f"{side.value}:{lane}"
                if self._lane_drills(battle, side, lane):
                    battle.drill_meters[key] = battle.drill_meters.get(key, 0.0) + DRILL_SPEED * METER_RATE
                else:
                    battle.drill_meters[key] = 0.0

    def _end_action(self, battle: Battle) -> None:
        battle.emit("end")
        battle.turn += 1
        self._spawn_waves(battle)
        self._evaluate(battle)

    # ── Abilities ───────────────────────────────────────────────────────────
    def _scope_lanes(self, scope: LaneScope, origin: int, target_lane: Optional[int]) -> List[int]:
        if scope == LaneScope.ALL_LANES:
            return list(range(LANE_COUNT))
        if scope == LaneScope.ADJACENT_LANES:
            return [l for l in (origin - 1, origin, origin + 1) if 0 <= l < LANE_COUNT]
        if scope == LaneScope.ANY_LANE:
            return [origin if target_lane is None else target_lane]
        return [origin]

    def _validate_unit_target(self, battle: Battle, actor: LaneUnit, card: CombatCard, unit_id: str) -> LaneUnit:
        """A hero may aim at a specific unit, provided it is alive, of the right side and within reach."""
        target = battle.get_unit(unit_id)
        if target is None or not target.is_alive or target.lane is None:
            raise ValueError("That target is no longer on the field.")
        wants_ally = card.target_type in (TargetType.LOWEST_HP_ALLY, TargetType.ALL_ALLIES, TargetType.SELF)
        if wants_ally and target.side != actor.side:
            raise ValueError(f"{card.name} must target an ally.")
        if not wants_ally and target.side == actor.side:
            raise ValueError(f"{card.name} must target an enemy.")
        reach = self._scope_lanes(card.lane_scope, actor.lane, target.lane)
        if target.lane not in reach:
            raise ValueError(f"{target.name} is out of reach for {card.name}.")
        return target

    def _auto_target_lane(self, battle: Battle, actor: LaneUnit, card: CombatCard) -> int:
        if card.target_type in (TargetType.ALL_ALLIES, TargetType.LOWEST_HP_ALLY, TargetType.SELF):
            # Support: the lane whose allies are hurting most.
            def ally_ratio(lane: int) -> float:
                allies = battle.living(Side.ALLY, lane)
                if not allies:
                    return 2.0
                return sum(a.hp for a in allies) / max(1, sum(a.max_hp for a in allies))
            return min(range(LANE_COUNT), key=ally_ratio)
        if card.summon_troop_id:
            return min(range(LANE_COUNT), key=lambda l: len(battle.living(Side.ALLY, l)))
        # Offense: finish the lane closest to being cleared.
        lanes_with_enemies = [l for l in range(LANE_COUNT) if battle.living(Side.ENEMY, l)]
        if not lanes_with_enemies:
            return actor.lane or 0
        return min(lanes_with_enemies, key=lambda l: sum(e.hp + e.shields for e in battle.living(Side.ENEMY, l)))

    def _gambit_choice(self, battle: Battle, actor: LaneUnit) -> CombatCard:
        available = actor.available_cards()
        if not available:
            return BASIC_ATTACK
        allies = [u.to_dict() for u in battle.living(Side.ALLY)]
        enemies = [u.to_dict() for u in battle.living(Side.ENEMY)]
        card = GambitEvaluator.evaluate(
            gambits=actor.gambits,
            actor=actor.to_dict(),
            allies=allies,
            enemies=enemies,
            available_cards=available,
        )
        return card or BASIC_ATTACK

    def _resolve_ability(
        self, battle: Battle, actor: LaneUnit, card: CombatCard, target_lane: Optional[int],
        target_unit: Optional[LaneUnit] = None,
    ) -> None:
        origin = actor.lane if actor.lane is not None else 0
        lanes = self._scope_lanes(card.lane_scope, origin, target_lane)
        foe = Side.ENEMY if actor.side == Side.ALLY else Side.ALLY
        friend = actor.side
        lane_label = "ALL LANES" if len(lanes) == LANE_COUNT else " + ".join(LANE_NAMES[l] for l in lanes)
        battle.log.append(f"🎯 {actor.name} uses {card.name} → {lane_label}.")
        battle.emit("ability", actor_id=actor.id, name=card.name, lanes=lanes, summon=bool(card.summon_troop_id))

        # Damage
        if card.power_multiplier > 0:
            foes = [u for l in lanes for u in battle.living(foe, l)]
            if card.target_type == TargetType.ALL_ENEMIES:
                for target in foes:
                    self._strike(battle, actor, target, actor.attack * card.power_multiplier, can_crit=True)
            elif card.target_type == TargetType.SINGLE_ENEMY and foes:
                # Heroes can pick off any target in reach (no screening): the chosen one, else the priority one.
                if target_unit is not None and target_unit in foes:
                    target = target_unit
                else:
                    target = min(foes, key=lambda u: (not (u.is_boss or u.is_elite), u.hp + u.shields))
                self._strike(battle, actor, target, actor.attack * card.power_multiplier, can_crit=True)

        # Shields
        if card.shield_grant > 0:
            if card.target_type == TargetType.ALL_ALLIES:
                for ally in [u for l in lanes for u in battle.living(friend, l)]:
                    self._grant_shields(ally, card.shield_grant)
                    battle.emit("shield", source_id=actor.id, target_id=ally.id, amount=card.shield_grant,
                                shields=ally.shields, max_shields=ally.max_shields)
                battle.log.append(f"🛡️ +{card.shield_grant} shields to allies in {lane_label}.")
            else:
                self._grant_shields(actor, card.shield_grant)
                battle.emit("shield", source_id=actor.id, target_id=actor.id, amount=card.shield_grant,
                            shields=actor.shields, max_shields=actor.max_shields)
                battle.log.append(f"🛡️ {actor.name} gains +{card.shield_grant} shields.")

        # Healing (troop packs regain soldiers when healed)
        if card.heal_multiplier > 0:
            amount = int(actor.attack * card.heal_multiplier)
            friends = [u for l in lanes for u in battle.living(friend, l)]
            if card.target_type == TargetType.ALL_ALLIES:
                for ally in friends:
                    self._heal(battle, actor, ally, amount)
                battle.log.append(f"💚 Allies in {lane_label} restored +{amount} HP.")
            elif friends:
                if target_unit is not None and target_unit in friends:
                    target = target_unit
                else:
                    target = min(friends, key=lambda u: u.hp / max(1, u.max_hp))
                self._heal(battle, actor, target, amount)
                battle.log.append(f"💚 {target.name} restored +{amount} HP.")

        # Summons
        if card.summon_troop_id:
            template = battle.summon_templates.get(card.summon_troop_id)
            if template:
                summon_lane = lanes[0]
                pack = LaneUnit.troop_from_template(
                    unit_id=f"sum_{uuid.uuid4().hex[:6]}",
                    template=template,
                    side=friend,
                    owner_id=actor.id,
                    lane=summon_lane,
                )
                battle.units.append(pack)
                battle.emit("summon", source_id=actor.id, unit_id=pack.id, lane=summon_lane, name=pack.name)
                battle.log.append(f"📦 {pack.name} ×{pack.count} deployed to {LANE_NAMES[summon_lane]}.")

    def _enemy_hero_turn(self, battle: Battle, hero: LaneUnit) -> None:
        self._tick_cooldowns(hero)
        card = None
        ready = hero.available_cards()
        if ready and hero.actions_taken % 3 == 2:
            card = ready[0]
        if card:
            self._resolve_ability(battle, hero, card, None)
            if card.cooldown_turns > 0:
                hero.cooldowns[card.id] = card.cooldown_turns
        else:
            target = battle.front_target(Side.ENEMY, hero.lane)
            if target is None:
                # Nothing in front: lob fire into a neighbouring lane.
                neighbours = [u for l in (hero.lane - 1, hero.lane + 1) if 0 <= l < LANE_COUNT
                              for u in battle.living(Side.ALLY, l)]
                target = self.rng.choice(neighbours) if neighbours else None
            if target:
                mult = 1.2 if hero.is_elite or hero.is_boss else 1.0
                self._strike(battle, hero, target, hero.attack * mult, can_crit=True)
        hero.turn_meter = 0.0
        hero.actions_taken += 1
        if hero.is_alive:
            self._volley(battle, Side.ENEMY, hero.lane)

    def _tick_cooldowns(self, unit: LaneUnit) -> None:
        for cid in list(unit.cooldowns):
            unit.cooldowns[cid] = max(0, unit.cooldowns[cid] - 1)

    # ── Troops ──────────────────────────────────────────────────────────────
    def _volley(self, battle: Battle, side: Side, lane: int) -> None:
        for pack in [u for u in battle.living(side, lane) if u.is_troop]:
            target = battle.front_target(side, lane)
            if target is None:
                return
            if not pack.is_alive:
                continue
            self._strike(battle, pack, target, pack.volley_power, can_crit=False)

    # ── Damage ──────────────────────────────────────────────────────────────
    def _strike(self, battle: Battle, attacker: LaneUnit, target: LaneUnit, raw: float, can_crit: bool) -> None:
        is_crit = can_crit and self.rng.random() < attacker.crit_rate
        if is_crit:
            raw *= attacker.crit_damage
        mitigation = 100.0 / (100.0 + max(0, target.defense))
        damage = max(1, int(raw * mitigation))

        absorbed = min(target.shields, damage)
        target.shields -= absorbed
        hull = damage - absorbed
        before_count = target.count
        target.hp = max(0, target.hp - hull)

        battle.emit(
            "hit", source_id=attacker.id, target_id=target.id, damage=damage, absorbed=absorbed, hull=hull,
            crit=is_crit, volley=attacker.is_troop, hp=target.hp, shields=target.shields, count=target.count,
            alive=target.hp > 0,
        )
        crit_tag = " [CRITICAL]" if is_crit else ""
        who = f"{attacker.name} ×{attacker.count}" if attacker.is_troop else attacker.name
        if target.is_troop and hull > 0:
            lost = before_count - target.count
            casualties = f" ({lost} down)" if lost > 0 else ""
            battle.log.append(f"💥 {who}{crit_tag} hits {target.name} for {damage}{casualties}.")
        elif hull == 0:
            battle.log.append(f"🛡️ {who}{crit_tag} hits {target.name}'s shields for {damage}.")
        else:
            battle.log.append(f"💥 {who}{crit_tag} hits {target.name} for {damage}.")

        if target.hp <= 0:
            target.is_alive = False
            target.turn_meter = 0.0
            battle.log.append(f"💀 {target.name} destroyed in {LANE_NAMES[target.lane]}!")

    @staticmethod
    def _heal(battle: Battle, source: LaneUnit, target: LaneUnit, amount: int) -> None:
        before = target.hp
        target.hp = min(target.max_hp, target.hp + amount)
        battle.emit("heal", source_id=source.id, target_id=target.id, amount=target.hp - before,
                    hp=target.hp, count=target.count)

    @staticmethod
    def _grant_shields(unit: LaneUnit, amount: int) -> None:
        cap = max(unit.max_shields, amount)
        unit.max_shields = cap
        unit.shields = min(cap, unit.shields + amount)

    # ── Waves & objectives ──────────────────────────────────────────────────
    def _spawn_waves(self, battle: Battle) -> None:
        for wave in battle.waves:
            if wave.spawned or battle.turn < wave.turn:
                continue
            wave.spawned = True
            for unit in wave.units:
                unit.lane = wave.lane
                unit.turn_meter = 0.0
                battle.units.append(unit)
            names = ", ".join(u.name for u in wave.units)
            battle.emit("wave", lane=wave.lane, unit_ids=[u.id for u in wave.units], names=names)
            battle.log.append(f"🚨 Reinforcements in {LANE_NAMES[wave.lane]}: {names}!")

    def _evaluate(self, battle: Battle) -> None:
        if battle.status != BattleStatus.IN_PROGRESS:
            return

        failed = False
        for obj in battle.objectives:
            if obj.type == ObjectiveType.CLEAR_LANES:
                cleared = sum(1 for l in range(LANE_COUNT) if battle.is_lane_cleared(l))
                obj.params["progress"] = cleared
                obj.status = "COMPLETE" if cleared >= obj.params.get("count", 2) else "PENDING"
            elif obj.type == ObjectiveType.SURVIVE_TURNS:
                obj.params["progress"] = min(battle.turn, obj.params.get("turns", 0))
                obj.status = "COMPLETE" if battle.turn >= obj.params.get("turns", 0) else "PENDING"
            elif obj.type == ObjectiveType.ELIMINATE_BOSS:
                boss_alive = any(u.is_boss for u in battle.living(Side.ENEMY))
                boss_pending = any(u.is_boss for w in battle.pending_waves() for u in w.units)
                obj.status = "PENDING" if boss_alive or boss_pending else "COMPLETE"
            elif obj.type == ObjectiveType.DEFEND_LANE:
                if obj.status != "FAILED" and not battle.is_lane_held(obj.params.get("lane", 1)):
                    obj.status = "FAILED"
                    battle.log.append(f"⚠️ {LANE_NAMES[obj.params.get('lane', 1)]} has fallen — defense objective failed.")
            if obj.status == "FAILED":
                failed = True

        if failed or not battle.living(Side.ALLY):
            battle.status = BattleStatus.LOST
            battle.current_actor_id = None
            battle.log.append("❌ Lane battle lost. Strike team pulls back.")
            return

        primaries = [o for o in battle.objectives if o.is_primary]
        if primaries and all(o.status == "COMPLETE" for o in primaries):
            for o in battle.objectives:
                if o.type == ObjectiveType.DEFEND_LANE:
                    o.status = "COMPLETE"
            battle.status = BattleStatus.WON
            battle.current_actor_id = None
            battle.log.append("🏆 All primary objectives secured!")
            return

        if battle.turn >= battle.max_turns or self._is_stalemate(battle):
            battle.status = BattleStatus.LOST
            battle.current_actor_id = None
            battle.log.append("❌ Offensive stalled — no way left to complete the objectives.")

    def _is_stalemate(self, battle: Battle) -> bool:
        """No ally hero left and no ally troop is facing anything it could still kill."""
        if any(u.is_hero for u in battle.living(Side.ALLY)):
            return False
        if any(o.type == ObjectiveType.SURVIVE_TURNS for o in battle.objectives if o.is_primary):
            return False
        for lane in range(LANE_COUNT):
            if battle.living(Side.ALLY, lane) and (battle.living(Side.ENEMY, lane) or battle.pending_waves(lane)):
                return False
        return True
