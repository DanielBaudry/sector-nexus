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
* Buffs / debuffs (see value_objects.status_effect) tick on the holder's own turns
  (troop packs: their volleys). Passives hook into turn start / end, kills, hits and stats.
* Colossal bosses (`spans_lanes`) stand in every lane at once. They use abilities on
  cooldown like heroes, wind up telegraphed attacks on a lane before unleashing them
  (a stun interrupts the wind-up) and shift phase at HP thresholds.
* When the board is empty, the next scheduled wave arrives immediately.
"""
import random
import time
import uuid
from typing import List, Optional

from src.domain.entities.battle import (
    LANE_COUNT,
    LANE_NAMES,
    MANA_PER_HERO_KILL,
    MANA_PER_LANE_CLEARED,
    MANA_PER_OBJECTIVE,
    MANA_PER_TROOP_KILL,
    Battle,
    LaneUnit,
)
from src.domain.services.gambit_evaluator import GambitEvaluator
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import (
    BattleStatus,
    LaneScope,
    ObjectiveType,
    Side,
    TargetType,
)
from src.domain.value_objects.status_effect import (
    DOT_TYPES,
    EFFECT_LABELS,
    MAX_DOT_STACKS,
    EffectOp,
    EffectSpec,
    EffectType,
    PassiveKind,
    StatusEffect,
    debuff_land_chance,
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
        self._acting_id: Optional[str] = None  # unit whose turn is resolving (fresh self-effects)

    # ── Lifecycle ───────────────────────────────────────────────────────────
    def begin(self, battle: Battle, now: Optional[float] = None, max_actions: Optional[int] = None) -> None:
        battle.status = BattleStatus.IN_PROGRESS
        # Every battle starts from scratch: empty turn meters, speed alone decides who acts first.
        for u in battle.units:
            u.turn_meter = 0.0
        for side in Side:
            for lane in range(LANE_COUNT):
                battle.drill_meters[f"{side.value}:{lane}"] = 0.0
        for u in list(battle.units):
            p = u.passive
            if u.is_alive and u.lane is not None and p and p.kind == PassiveKind.BATTLE_START_EFFECT and p.effect:
                for ally in battle.living(u.side, u.lane):
                    self._apply_effect(battle, u, ally, p.effect)
        battle.cleared_lanes = [battle.is_lane_cleared(l) for l in range(LANE_COUNT)]
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
            if unit is not None and unit.side == Side.ALLY and not unit.has_effect(EffectType.STUN):
                state = self._start_turn(battle, unit)
                if state == "dead":
                    self._end_action(battle)
                    continue
                battle.current_actor_id = unit.id
                battle.turn_started_at = time.time() if now is None else now
                battle.log.append(f"⚡ {unit.name} ready in {LANE_NAMES[unit.lane]} — choose an ability.")
                battle.emit("ready", actor_id=unit.id, lane=unit.lane)
                return
            if max_actions is not None and actions >= max_actions:
                return
            actions += 1

            if unit is not None and unit.side == Side.ALLY:
                # Stunned ally hero: the turn resolves on its own.
                battle.emit("turn", actor_id=unit.id, side=unit.side.value, lane=unit.lane, drill=False)
                self._skip_turn(battle, unit)
                self._end_action(battle)
                continue

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
            if unit.spans_lanes:
                self._boss_turn(battle, unit)
            else:
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
        self._acting_id = actor.id
        self._resolve_ability(battle, actor, card, target_lane, target_unit)
        if card.cooldown_turns > 0:
            actor.cooldowns[card.id] = card.cooldown_turns
        actor.turn_meter = 0.0
        actor.actions_taken += 1
        battle.current_actor_id = None
        self._end_turn(battle, actor)

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
                u.turn_meter += max(5.0, battle.effective(u, "speed") * METER_RATE)
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
        self._check_boss_phases(battle)
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
        if target.lane not in reach and not target.spans_lanes:
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
        target_unit: Optional[LaneUnit] = None, origin_lane: Optional[int] = None,
    ) -> None:
        origin = origin_lane if origin_lane is not None else (actor.lane if actor.lane is not None else 0)
        lanes = self._scope_lanes(card.lane_scope, origin, target_lane)
        foe = Side.ENEMY if actor.side == Side.ALLY else Side.ALLY
        friend = actor.side
        lane_label = "ALL LANES" if len(lanes) == LANE_COUNT else " + ".join(LANE_NAMES[l] for l in lanes)
        battle.log.append(f"🎯 {actor.name} uses {card.name} → {lane_label}.")
        battle.emit("ability", actor_id=actor.id, name=card.name, lanes=lanes, summon=bool(card.summon_troop_id))
        if card.mana_gain and actor.side == Side.ALLY:
            battle.gain_mana(card.mana_gain, card.name, actor.id)
            battle.log.append(f"🔷 {card.name}: +{card.mana_gain} mana.")

        attack = battle.effective(actor, "attack")
        hit_targets: List[LaneUnit] = []
        foes = self._units_in(battle, foe, lanes)

        # Damage
        if card.power_multiplier > 0:
            if card.target_type == TargetType.ALL_ENEMIES:
                for target in foes:
                    self._strike(battle, actor, target, attack * card.power_multiplier, can_crit=True)
                    hit_targets.append(target)
            elif card.target_type == TargetType.SINGLE_ENEMY and foes:
                target = self._pick_enemy(foes, target_unit)
                self._strike(battle, actor, target, attack * card.power_multiplier, can_crit=True)
                hit_targets.append(target)
        elif card.target_type == TargetType.SINGLE_ENEMY and foes:
            # Pure debuff / strip abilities still pick a target.
            hit_targets.append(self._pick_enemy(foes, target_unit))
        elif card.target_type == TargetType.ALL_ENEMIES:
            hit_targets.extend(foes)

        # Shields
        if card.shield_grant > 0:
            if card.target_type == TargetType.ALL_ALLIES:
                for ally in self._units_in(battle, friend, lanes):
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
        friends = self._units_in(battle, friend, lanes)
        chosen_ally: Optional[LaneUnit] = None
        if friends and card.target_type in (TargetType.LOWEST_HP_ALLY, TargetType.SELF, TargetType.ALL_ALLIES):
            if target_unit is not None and target_unit in friends:
                chosen_ally = target_unit
            elif card.target_type == TargetType.SELF and actor in friends:
                chosen_ally = actor
            else:
                chosen_ally = min(friends, key=lambda u: u.hp / max(1, u.max_hp))
        if card.heal_multiplier > 0:
            amount = int(attack * card.heal_multiplier)
            if card.target_type == TargetType.ALL_ALLIES:
                for ally in friends:
                    self._heal(battle, actor, ally, amount)
                battle.log.append(f"💚 Allies in {lane_label} restored +{amount} HP.")
            elif friends:
                if chosen_ally is not None and card.target_type != TargetType.SELF:
                    target = chosen_ally
                else:  # self-heal cards and lifesteal (enemy-target) cards mend the most wounded ally
                    target = min(friends, key=lambda u: u.hp / max(1, u.max_hp))
                chosen_ally = target
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

        # Status effects: buffs, debuffs, cleanse / strip / steal
        for spec in card.effects:
            targets = {
                "self": [actor],
                "ally": [chosen_ally or actor],
                "allies": friends,
                "hit": hit_targets,
                "enemies": foes,
            }.get(spec.target, [])
            for target in targets:
                if target.is_alive:
                    self._apply_spec(battle, actor, target, spec)

        # Passive: abilities may apply an extra effect to every target hit.
        p = actor.passive
        if p and p.kind == PassiveKind.ON_HIT_EFFECT and p.effect:
            for target in hit_targets:
                if target.is_alive:
                    self._apply_spec(battle, actor, target, p.effect)

    @staticmethod
    def _units_in(battle: Battle, side: Side, lanes: List[int]) -> List[LaneUnit]:
        """Living units of `side` across `lanes`, each once (lane-spanning bosses sit in every lane)."""
        seen, out = set(), []
        for lane in lanes:
            for u in battle.living(side, lane):
                if u.id not in seen:
                    seen.add(u.id)
                    out.append(u)
        return out

    @staticmethod
    def _pick_enemy(foes: List[LaneUnit], target_unit: Optional[LaneUnit]) -> LaneUnit:
        # Heroes can pick off any target in reach (no screening): the chosen one, else the priority one.
        if target_unit is not None and target_unit in foes:
            return target_unit
        return min(foes, key=lambda u: (not (u.is_boss or u.is_elite), u.hp + u.shields))

    def _enemy_hero_turn(self, battle: Battle, hero: LaneUnit) -> None:
        if hero.has_effect(EffectType.STUN):
            self._skip_turn(battle, hero)
            return
        if self._start_turn(battle, hero) == "dead":
            return
        self._acting_id = hero.id
        self._tick_cooldowns(hero)
        card = None
        ready = [c for c in hero.available_cards() if self._enemy_card_useful(battle, hero, c)]
        # Single-ability enemies cast every 3rd action; multi-ability threats every other action.
        cadence = 2 if len(hero.cards) > 1 else 3
        if ready and hero.actions_taken % cadence == cadence - 1:
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
                self._strike(battle, hero, target, battle.effective(hero, "attack") * mult, can_crit=True)
                p = hero.passive
                if p and p.kind == PassiveKind.ON_HIT_EFFECT and p.effect and target.is_alive:
                    self._apply_spec(battle, hero, target, p.effect)
        hero.turn_meter = 0.0
        hero.actions_taken += 1
        self._end_turn(battle, hero)
        if hero.is_alive:
            self._volley(battle, Side.ENEMY, hero.lane)

    # ── Colossal boss ───────────────────────────────────────────────────────
    def _boss_turn(self, battle: Battle, boss: LaneUnit) -> None:
        """
        A lane-spanning boss: unleash a wound-up attack when it is due, otherwise cast the
        best ready ability (telegraphed ones start winding up instead), else a claw strike.
        """
        if boss.has_effect(EffectType.STUN):
            self._interrupt(battle, boss)
            self._skip_turn(battle, boss)
            return
        if self._start_turn(battle, boss) == "dead":
            return
        self._acting_id = boss.id
        self._tick_cooldowns(boss)

        intent = boss.intent
        if intent:
            intent["turns"] -= 1
            card = next((c for c in boss.cards if c.id == intent["card_id"]), None)
            if intent["turns"] <= 0 or card is None:
                boss.intent = None
                if card is not None:
                    battle.emit("telegraph", unit_id=boss.id, card_id=card.id, name=card.name,
                                lanes=intent["lanes"], turns=0, action="unleash")
                    self._resolve_ability(battle, boss, card, intent["lanes"][0], origin_lane=intent["lanes"][0])
                    boss.cooldowns[card.id] = card.cooldown_turns
            else:
                battle.log.append(f"⏳ {boss.name} keeps charging {intent['name']} ({intent['turns']} turn(s) left).")
                self._boss_basic_attack(battle, boss)
        else:
            card = self._boss_pick_card(battle, boss)
            if card is not None and card.telegraph_turns > 0:
                lane = self._boss_target_lane(battle, boss, card)
                lanes = self._scope_lanes(card.lane_scope, lane, lane)
                boss.intent = {"card_id": card.id, "name": card.name, "lanes": lanes,
                               "turns": card.telegraph_turns, "description": card.description}
                label = "ALL LANES" if len(lanes) == LANE_COUNT else " + ".join(LANE_NAMES[l] for l in lanes)
                battle.emit("telegraph", unit_id=boss.id, card_id=card.id, name=card.name,
                            lanes=lanes, turns=card.telegraph_turns, action="charge")
                battle.log.append(
                    f"⚠️ {boss.name} winds up {card.name} → {label} in {card.telegraph_turns} turn(s)! Brace or stun it."
                )
                self._boss_basic_attack(battle, boss)
            elif card is not None:
                lane = self._boss_target_lane(battle, boss, card)
                self._resolve_ability(battle, boss, card, lane, origin_lane=lane)
                if card.cooldown_turns > 0:
                    boss.cooldowns[card.id] = card.cooldown_turns
            else:
                self._boss_basic_attack(battle, boss)

        boss.turn_meter = 0.0
        boss.actions_taken += 1
        self._end_turn(battle, boss)
        if boss.is_alive:
            for lane in range(LANE_COUNT):
                self._volley(battle, Side.ENEMY, lane)

    def _boss_pick_card(self, battle: Battle, boss: LaneUnit) -> Optional[CombatCard]:
        """Ready abilities unlocked in the current phase; signature (later-phase) abilities first."""
        ready = [
            (i, c) for i, c in enumerate(boss.cards)
            if c.phase <= boss.phase and boss.cooldowns.get(c.id, 0) <= 0 and self._enemy_card_useful(battle, boss, c)
        ]
        if not ready:
            return None
        ready.sort(key=lambda ic: (-ic[1].phase, ic[0]))
        return ready[0][1]

    def _boss_target_lane(self, battle: Battle, boss: LaneUnit, card: CombatCard) -> int:
        """Hit where it hurts: the lane holding the most allied strength (heroes weigh double)."""
        if card.summon_troop_id:
            return min(range(LANE_COUNT), key=lambda l: (len([u for u in battle.living(Side.ENEMY, l) if u.is_troop]), self.rng.random()))

        def weight(lane: int) -> float:
            return sum((2.0 if u.is_hero else 1.0) * (u.hp + u.shields) for u in battle.living(Side.ALLY, lane))
        lanes = [l for l in range(LANE_COUNT) if battle.living(Side.ALLY, l)]
        if not lanes:
            return 1
        return max(lanes, key=lambda l: (weight(l), self.rng.random()))

    def _boss_basic_attack(self, battle: Battle, boss: LaneUnit) -> None:
        lanes = [l for l in range(LANE_COUNT) if battle.living(Side.ALLY, l)]
        if not lanes:
            return
        lane = self.rng.choice(lanes)
        target = battle.front_target(Side.ENEMY, lane)
        if target is None:
            return
        battle.log.append(f"🦴 {boss.name} lashes out at {LANE_NAMES[lane]}.")
        self._strike(battle, boss, target, battle.effective(boss, "attack"), can_crit=True)
        p = boss.passive
        if p and p.kind == PassiveKind.ON_HIT_EFFECT and p.effect and target.is_alive:
            self._apply_spec(battle, boss, target, p.effect)

    def _interrupt(self, battle: Battle, boss: LaneUnit) -> None:
        """A stun breaks a wind-up: the attack is lost and goes on cooldown."""
        if not boss.intent:
            return
        intent, boss.intent = boss.intent, None
        boss.cooldowns[intent["card_id"]] = next(
            (c.cooldown_turns for c in boss.cards if c.id == intent["card_id"]), 0
        )
        battle.emit("telegraph", unit_id=boss.id, card_id=intent["card_id"], name=intent["name"],
                    lanes=intent["lanes"], turns=0, action="interrupted")
        battle.log.append(f"💥 {boss.name}'s {intent['name']} is INTERRUPTED!")

    def _check_boss_phases(self, battle: Battle) -> None:
        for boss in battle.units:
            if not boss.phases or not boss.is_alive or boss.lane is None:
                continue
            ratio = boss.hp / max(1, boss.max_hp)
            while boss.phase + 1 < len(boss.phases) and ratio <= boss.phases[boss.phase + 1].get("threshold", 0):
                boss.phase += 1
                self._enter_phase(battle, boss, boss.phases[boss.phase])

    def _enter_phase(self, battle: Battle, boss: LaneUnit, phase: dict) -> None:
        battle.emit("phase", unit_id=boss.id, phase=boss.phase, name=phase.get("name", ""),
                    description=phase.get("description", ""))
        battle.log.append(f"🔥 {boss.name} enters PHASE {boss.phase + 1}: {phase.get('name', '')}! {phase.get('description', '')}")
        self._acting_id = boss.id
        for spec_data in phase.get("effects", []):
            spec = spec_data if isinstance(spec_data, EffectSpec) else EffectSpec.from_dict(spec_data)
            self._apply_spec(battle, boss, boss, spec)
        shield = int(boss.max_hp * phase.get("shield_pct", 0.0))
        if shield > 0:
            self._grant_shields(boss, shield)
            battle.emit("shield", source_id=boss.id, target_id=boss.id, amount=shield,
                        shields=boss.shields, max_shields=boss.max_shields)
        for summon in phase.get("summons", []):
            template = battle.summon_templates.get(summon["template_id"])
            if not template:
                continue
            for lane in summon.get("lanes", []):
                pack = LaneUnit.troop_from_template(
                    unit_id=f"sum_{uuid.uuid4().hex[:6]}", template=template, side=boss.side,
                    owner_id=boss.id, lane=lane,
                )
                battle.units.append(pack)
                battle.emit("summon", source_id=boss.id, unit_id=pack.id, lane=lane, name=pack.name)
                battle.log.append(f"📦 {pack.name} ×{pack.count} burst into {LANE_NAMES[lane]}.")
        self._acting_id = None

    def _enemy_card_useful(self, battle: Battle, hero: LaneUnit, card: CombatCard) -> bool:
        """Skip pure-heal abilities when no nearby hostile is hurt, and summons when the summon is unknown."""
        if card.summon_troop_id and card.summon_troop_id not in battle.summon_templates:
            return card.power_multiplier > 0 or card.shield_grant > 0 or card.heal_multiplier > 0
        if card.heal_multiplier > 0 and card.power_multiplier <= 0 and card.shield_grant <= 0 and not card.summon_troop_id:
            lanes = self._scope_lanes(card.lane_scope, hero.lane, None)
            return any(u.hp < u.max_hp * 0.7 for l in lanes for u in battle.living(hero.side, l))
        return True

    def _tick_cooldowns(self, unit: LaneUnit) -> None:
        for cid in list(unit.cooldowns):
            unit.cooldowns[cid] = max(0, unit.cooldowns[cid] - 1)

    # ── Turn lifecycle & status effects ─────────────────────────────────────
    def _start_turn(self, battle: Battle, unit: LaneUnit) -> str:
        """Turn-start upkeep: damage over time, regeneration, passive regen. Returns 'act' or 'dead'."""
        self._acting_id = unit.id
        for e in [e for e in unit.effects if e.type in DOT_TYPES]:
            dmg = max(1, int(unit.max_hp * e.value))
            unit.hp = max(0, unit.hp - dmg)
            battle.emit("dot", target_id=unit.id, effect=e.type.value, label=EFFECT_LABELS[e.type], damage=dmg,
                        hp=unit.hp, shields=unit.shields, count=unit.count, alive=unit.hp > 0)
            if unit.hp <= 0:
                battle.log.append(f"🔥 {unit.name} succumbs to {EFFECT_LABELS[e.type].lower()}.")
                self._kill(battle, unit)
                return "dead"
        regen = unit.effect_total(EffectType.REGEN)
        if regen > 0:
            self._heal(battle, unit, unit, int(unit.max_hp * regen))
        p = unit.passive
        if p and p.kind == PassiveKind.REGEN:
            targets = battle.living(unit.side, unit.lane) if p.lane_wide else [unit]
            for t in targets:
                if t.hp < t.max_hp:
                    self._heal(battle, unit, t, int(t.max_hp * p.value))
        elif p and p.kind == PassiveKind.SHIELD_REGEN and unit.max_shields > 0 and unit.shields < unit.max_shields:
            amount = int(unit.max_shields * p.value)
            unit.shields = min(unit.max_shields, unit.shields + amount)
            battle.emit("shield", source_id=unit.id, target_id=unit.id, amount=amount,
                        shields=unit.shields, max_shields=unit.max_shields)
        return "act"

    def _end_turn(self, battle: Battle, unit: LaneUnit) -> None:
        """Turn-end upkeep: passive stacks, then effect durations tick (fresh effects skip this tick)."""
        p = unit.passive
        if unit.is_alive and p and p.kind == PassiveKind.STACK_ON_TURN_END and unit.passive_stacks < p.max_stacks:
            unit.passive_stacks += 1
            battle.emit("passive", unit_id=unit.id, name=p.name,
                        text=f"{p.name} ×{unit.passive_stacks}")
        kept: List[StatusEffect] = []
        for e in unit.effects:
            if e.fresh:
                e.fresh = False
                kept.append(e)
                continue
            e.turns -= 1
            if e.turns > 0:
                kept.append(e)
        unit.effects = kept
        self._acting_id = None

    def _consume_stun(self, battle: Battle, unit: LaneUnit) -> None:
        unit.effects = [e for e in unit.effects if e.type != EffectType.STUN]
        battle.emit("effect", source_id=None, target_id=unit.id, effect="STUN", label="STUNNED",
                    is_buff=False, action="skip", turns=0)
        battle.log.append(f"💫 {unit.name} is stunned and loses the turn.")

    def _skip_turn(self, battle: Battle, hero: LaneUnit) -> None:
        """A stunned hero's turn: upkeep, no action, its lane troops still fire."""
        self._consume_stun(battle, hero)
        state = self._start_turn(battle, hero)
        hero.turn_meter = 0.0
        hero.actions_taken += 1
        self._end_turn(battle, hero)
        if state != "dead" and hero.is_alive:
            for lane in (range(LANE_COUNT) if hero.spans_lanes else [hero.lane]):
                self._volley(battle, hero.side, lane)

    def _apply_spec(self, battle: Battle, source: LaneUnit, target: LaneUnit, spec: EffectSpec) -> None:
        op = spec.op
        if op == EffectOp.CLEANSE:
            removed = target.debuffs[-spec.count:] if spec.count > 0 else []
            for e in removed:
                target.effects.remove(e)
                battle.emit("effect", source_id=source.id, target_id=target.id, effect=e.type.value,
                            label=EFFECT_LABELS[e.type], is_buff=False, action="removed", turns=0)
            if removed:
                battle.log.append(f"✨ {target.name} cleansed of {', '.join(EFFECT_LABELS[e.type] for e in removed)}.")
            return
        if op in (EffectOp.STRIP, EffectOp.STEAL):
            candidates = target.buffs[-spec.count:] if spec.count > 0 else []
            if not candidates:
                return
            if self.rng.random() > debuff_land_chance(spec.chance, source.accuracy, target.resistance):
                battle.emit("effect", source_id=source.id, target_id=target.id, effect=op.value,
                            label="RESISTED", is_buff=False, action="resisted", turns=0)
                return
            for e in candidates:
                target.effects.remove(e)
                action = "stolen" if op == EffectOp.STEAL else "removed"
                battle.emit("effect", source_id=source.id, target_id=target.id, effect=e.type.value,
                            label=EFFECT_LABELS[e.type], is_buff=True, action=action, turns=0)
                if op == EffectOp.STEAL and source.is_alive:
                    self._add_effect(battle, source, StatusEffect(e.type, e.value, e.turns, source.id))
            verb = "steals" if op == EffectOp.STEAL else "strips"
            battle.log.append(f"🧲 {source.name} {verb} {', '.join(EFFECT_LABELS[e.type] for e in candidates)} from {target.name}.")
            return

        et = spec.effect_type
        if et is None:
            return
        effect = StatusEffect(et, spec.value, spec.turns, source.id)
        if not effect.is_buff:
            if target.has_effect(EffectType.IMMUNITY):
                battle.emit("effect", source_id=source.id, target_id=target.id, effect=et.value,
                            label="IMMUNE", is_buff=False, action="blocked", turns=0)
                return
            if self.rng.random() > debuff_land_chance(spec.chance, source.accuracy, target.resistance):
                battle.emit("effect", source_id=source.id, target_id=target.id, effect=et.value,
                            label="RESISTED", is_buff=False, action="resisted", turns=0)
                battle.log.append(f"🛡️ {target.name} resists {EFFECT_LABELS[et]}.")
                return
        self._add_effect(battle, target, effect)
        battle.log.append(f"{'⬆️' if effect.is_buff else '⬇️'} {target.name}: {EFFECT_LABELS[et]} for {effect.turns} turn(s).")

    def _add_effect(self, battle: Battle, target: LaneUnit, effect: StatusEffect) -> None:
        """Same effect: refresh duration and keep the stronger value. DoTs stack up to a cap."""
        effect.fresh = target.id == self._acting_id
        same = [e for e in target.effects if e.type == effect.type]
        if effect.type in DOT_TYPES and len(same) < MAX_DOT_STACKS:
            target.effects.append(effect)
        elif same:
            current = same[0]
            current.turns = max(current.turns, effect.turns)
            current.value = max(current.value, effect.value)
            current.fresh = current.fresh or effect.fresh
            current.source_id = effect.source_id
        else:
            target.effects.append(effect)
        battle.emit("effect", source_id=effect.source_id, target_id=target.id, effect=effect.type.value,
                    label=EFFECT_LABELS[effect.type], is_buff=effect.is_buff, action="applied", turns=effect.turns)

    # ── Troops ──────────────────────────────────────────────────────────────
    def _volley(self, battle: Battle, side: Side, lane: int) -> None:
        for pack in [u for u in battle.living(side, lane) if u.is_troop]:
            if not pack.is_alive:
                continue
            if pack.has_effect(EffectType.STUN):
                self._consume_stun(battle, pack)
                self._end_turn(battle, pack)
                continue
            if self._start_turn(battle, pack) == "dead":
                continue
            target = battle.front_target(side, lane)
            if target is not None:
                self._acting_id = pack.id
                self._strike(battle, pack, target, battle.effective(pack, "attack"), can_crit=False)
            self._end_turn(battle, pack)

    # ── Damage ──────────────────────────────────────────────────────────────
    def _strike(self, battle: Battle, attacker: LaneUnit, target: LaneUnit, raw: float, can_crit: bool) -> None:
        is_crit = can_crit and self.rng.random() < battle.effective(attacker, "crit_rate")
        if is_crit:
            raw *= attacker.crit_damage
        raw *= 1.0 + target.effect_total(EffectType.MARKED)
        p = attacker.passive
        if p and p.kind == PassiveKind.DAMAGE_VS_DEBUFFED and target.debuffs:
            raw *= 1.0 + p.value
        mitigation = 100.0 / (100.0 + max(0.0, battle.effective(target, "defense")))
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
            self._kill(battle, target)
            if p and p.kind == PassiveKind.ON_KILL_METER and attacker.is_hero and attacker.is_alive:
                attacker.turn_meter = min(METER_FULL * 1.5, attacker.turn_meter + p.value)
                battle.emit("passive", unit_id=attacker.id, name=p.name, text=f"+{int(p.value)}% TURN METER")
                battle.log.append(f"✨ {attacker.name}'s {p.name}: +{int(p.value)}% turn meter.")

    @staticmethod
    def _kill(battle: Battle, target: LaneUnit) -> None:
        target.is_alive = False
        target.turn_meter = 0.0
        target.effects = []
        battle.log.append(f"💀 {target.name} destroyed in {LANE_NAMES[target.lane]}!")
        if target.side == Side.ENEMY:
            battle.gain_mana(MANA_PER_TROOP_KILL if target.is_troop else MANA_PER_HERO_KILL, "kill", target.id)

    @staticmethod
    def _heal(battle: Battle, source: LaneUnit, target: LaneUnit, amount: int) -> None:
        if target.has_effect(EffectType.HEAL_BLOCK):
            battle.emit("effect", source_id=source.id, target_id=target.id, effect="HEAL_BLOCK",
                        label="HEAL BLOCKED", is_buff=False, action="blocked", turns=0)
            battle.log.append(f"🚫 {target.name} cannot be healed (Heal Block).")
            return
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
        # Never leave the board empty: with no hostile left, the next wave drops in now.
        pending = battle.pending_waves()
        if pending and not battle.living(Side.ENEMY):
            soonest = min(w.turn for w in pending)
            for w in pending:
                if w.turn == soonest:
                    w.turn = battle.turn
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
                turns = obj.params.get("turns", 0)
                wiped_out = not battle.living(Side.ENEMY) and not battle.pending_waves()
                obj.params["progress"] = turns if wiped_out else min(battle.turn, turns)
                obj.status = "COMPLETE" if battle.turn >= turns or wiped_out else "PENDING"
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

        self._reward_progress(battle)
        primaries = [o for o in battle.objectives if o.is_primary]
        if primaries and all(o.status == "COMPLETE" for o in primaries):
            for o in battle.objectives:
                if o.type == ObjectiveType.DEFEND_LANE:
                    o.status = "COMPLETE"
            self._reward_progress(battle)
            battle.status = BattleStatus.WON
            battle.current_actor_id = None
            battle.log.append("🏆 All primary objectives secured!")
            return

        if battle.turn >= battle.max_turns or self._is_stalemate(battle):
            battle.status = BattleStatus.LOST
            battle.current_actor_id = None
            battle.log.append("❌ Offensive stalled — no way left to complete the objectives.")

    @staticmethod
    def _reward_progress(battle: Battle) -> None:
        """Mana for lanes that just got cleared and objectives completed (each objective pays once)."""
        if len(battle.cleared_lanes) == LANE_COUNT:
            for lane in range(LANE_COUNT):
                cleared = battle.is_lane_cleared(lane)
                if cleared and not battle.cleared_lanes[lane]:
                    battle.gain_mana(MANA_PER_LANE_CLEARED, "lane", None)
                battle.cleared_lanes[lane] = cleared
        for obj in battle.objectives:
            if obj.status == "COMPLETE" and not obj.params.get("mana_paid"):
                obj.params["mana_paid"] = True
                battle.gain_mana(MANA_PER_OBJECTIVE, "objective", None)

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
