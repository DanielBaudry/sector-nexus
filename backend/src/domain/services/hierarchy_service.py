"""
Planet hierarchy rules: who can be challenged, how Influence is earned and banked,
and how a champion adapts after beating the player.

Core loop: choose a champion -> complete expeditions on its planet (Influence) ->
the champion becomes vulnerable -> boss fight -> claim it -> climb the hierarchy.
"""
import copy
from typing import Any, Dict, List, Optional

from src.domain.entities.boss_encounter import BossEncounter, HierarchyRank
from src.domain.entities.hierarchy_standing import ChampionStatus, HierarchyStanding
from src.domain.value_objects.difficulty import Difficulty
from src.domain.value_objects.enums import NodeType, RunStatus

# Influence per battle won in an expedition targeting a champion (difficulty scales it).
NODE_INFLUENCE = {NodeType.COMBAT: 8, NodeType.ELITE: 16, NodeType.BOSS: 30}
INFLUENCE_PER_STEP = 0.15
# Share of the Influence gathered during a run that is banked when the run ends.
RUN_END_SHARE = {RunStatus.VICTORY: 1.0, RunStatus.ABANDONED: 0.5, RunStatus.DEFEAT: 0.25}

# A champion that beats the player adapts. Each loss unlocks the next adaptation (cumulative).
ADAPTATIONS: List[Dict[str, Any]] = [
    {"name": "Hardened Hide", "description": "+12% HP and +10 defense.", "hp_pct": 0.12, "defense": 10},
    {"name": "Reinforcements", "description": "Opens the fight with an escort pack on both flanks.", "opening_adds": [0, 2]},
    {"name": "Vengeful Fury", "description": "+15% attack and +8 speed.", "attack_pct": 0.15, "speed": 8},
]
MAX_ADAPTATIONS = len(ADAPTATIONS)


class HierarchyService:
    # ── Status ──────────────────────────────────────────────────────────────
    @staticmethod
    def status(boss: BossEncounter, standing: HierarchyStanding, bosses: List[BossEncounter],
               standings: Dict[str, HierarchyStanding]) -> ChampionStatus:
        if standing.defeated:
            return ChampionStatus.DEFEATED
        subordinates = [b for b in bosses if b.superior_id == boss.id]
        fallen = [b for b in subordinates if standings.get(b.id) and standings[b.id].defeated]
        if subordinates:
            # The overlord only shows itself once every lieutenant is down; others need one breach.
            needed = len(subordinates) if boss.rank == HierarchyRank.OVERLORD else 1
            if len(fallen) < needed:
                return ChampionStatus.LOCKED
        if standing.influence >= boss.influence_required:
            return ChampionStatus.VULNERABLE
        return ChampionStatus.HUNTED

    @staticmethod
    def unlock_hint(boss: BossEncounter, bosses: List[BossEncounter]) -> str:
        subordinates = [b.name for b in bosses if b.superior_id == boss.id]
        if not subordinates:
            return ""
        if boss.rank == HierarchyRank.OVERLORD:
            return f"Defeat {' and '.join(subordinates)} to expose them."
        return f"Defeat {' or '.join(subordinates)} to expose them."

    # ── Targeting ───────────────────────────────────────────────────────────
    @classmethod
    def set_target(cls, boss: BossEncounter, bosses: List[BossEncounter],
                   standings: Dict[str, HierarchyStanding]) -> List[HierarchyStanding]:
        """Mark `boss` as the planet's target (one per planet). Returns the standings that changed."""
        st = cls.status(boss, standings[boss.id], bosses, standings)
        if st == ChampionStatus.LOCKED:
            raise ValueError(f"{boss.name} is protected by their subordinates. {cls.unlock_hint(boss, bosses)}")
        if st == ChampionStatus.DEFEATED:
            raise ValueError(f"{boss.name} has already fallen.")
        changed = []
        for s in standings.values():
            want = s.boss_id == boss.id
            if s.targeted != want:
                s.targeted = want
                changed.append(s)
        return changed

    # ── Influence ───────────────────────────────────────────────────────────
    @staticmethod
    def node_influence(node_type: NodeType, difficulty: int) -> int:
        base = NODE_INFLUENCE.get(node_type, 0)
        return int(round(base * (1.0 + INFLUENCE_PER_STEP * Difficulty(difficulty).step)))

    @staticmethod
    def bank_run_influence(standing: HierarchyStanding, boss: BossEncounter, gathered: int,
                           run_status: RunStatus) -> int:
        """Bank the run's share of Influence (never above the requirement). Returns what was banked."""
        share = RUN_END_SHARE.get(run_status, 0.0)
        room = max(0, boss.influence_required - standing.influence)
        banked = min(room, int(gathered * share))
        standing.influence += banked
        return banked

    # ── Boss fight outcome ──────────────────────────────────────────────────
    @staticmethod
    def record_fight(standing: HierarchyStanding, won: bool) -> Dict[str, Any]:
        """Defeat claims the champion; a loss keeps all progress but the champion adapts."""
        if won:
            standing.defeated = True
            standing.targeted = False
            return {"claimed": True}
        standing.losses = min(MAX_ADAPTATIONS, standing.losses + 1)
        return {"claimed": False, "adaptation": ADAPTATIONS[standing.losses - 1]}

    @staticmethod
    def claim_rewards(boss: BossEncounter) -> Dict[str, Any]:
        """
        What claiming a champion grants. Not granted yet: recruiting the champion as a
        playable hero (`recruit_template_id`) and the seat bonus (`claim_bonus`) plug in here.
        """
        return {"recruit_template_id": None, "claim_bonus": None}

    @staticmethod
    def adaptations(losses: int) -> List[Dict[str, Any]]:
        return ADAPTATIONS[: max(0, min(losses, MAX_ADAPTATIONS))]

    @classmethod
    def adapted(cls, boss: BossEncounter, losses: int) -> BossEncounter:
        """A copy of the boss carrying every adaptation earned by beating the player."""
        out = copy.deepcopy(boss)
        for a in cls.adaptations(losses):
            out.hp = int(out.hp * (1 + a.get("hp_pct", 0.0)))
            out.attack = int(out.attack * (1 + a.get("attack_pct", 0.0)))
            out.defense += a.get("defense", 0)
            out.speed += a.get("speed", 0)
            if a.get("opening_adds") and out.summons and out.phases:
                template_id = next(iter(out.summons))
                out.phases[0].setdefault("summons", []).append({"template_id": template_id, "lanes": a["opening_adds"]})
        return out

    # ── Views ───────────────────────────────────────────────────────────────
    @classmethod
    def planet_view(cls, bosses: List[BossEncounter], standings: Dict[str, HierarchyStanding]) -> Dict[str, Any]:
        champions = []
        for boss in bosses:
            s = standings[boss.id]
            st = cls.status(boss, s, bosses, standings)
            champions.append({
                **boss.to_dict(),
                "standing": s.to_dict(),
                "status": st.value,
                "unlock_hint": cls.unlock_hint(boss, bosses) if st == ChampionStatus.LOCKED else "",
                "subordinate_ids": [b.id for b in bosses if b.superior_id == boss.id],
                "adaptations": cls.adaptations(s.losses),
                "next_adaptation": ADAPTATIONS[s.losses] if s.losses < MAX_ADAPTATIONS else None,
            })
        target = next((s.boss_id for s in standings.values() if s.targeted and not s.defeated), None)
        return {
            "champions": champions,
            "target_id": target,
            "influence_rules": {
                "per_node": {k.value: v for k, v in NODE_INFLUENCE.items()},
                "per_difficulty_step": INFLUENCE_PER_STEP,
                "run_end_share": {k.value: v for k, v in RUN_END_SHARE.items()},
            },
        }

    @staticmethod
    def find_target(standings: List[HierarchyStanding]) -> Optional[HierarchyStanding]:
        return next((s for s in standings if s.targeted and not s.defeated), None)
