"""
Content schema: the shape of every design file under `backend/content/`.

These models are the single source of truth for game content:
- the loader validates every file against them (typos and bad values fail loudly);
- `scripts/export_content_schema.py` turns them into JSON Schemas so editors
  (VS Code) autocomplete and validate the files while you type.
"""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.domain.value_objects.enums import (
    Faction,
    GambitCondition,
    LaneScope,
    Rarity,
    Role,
    TargetType,
)
from src.domain.value_objects.status_effect import EffectOp, EffectType, PassiveKind

# Literal unions built from the domain enums, so the schema lists every allowed value.
EffectKind = Literal[tuple(e.value for e in list(EffectType) + list(EffectOp))]  # type: ignore[valid-type]
EffectTarget = Literal["self", "ally", "allies", "hit", "enemies"]
PassiveKindV = Literal[tuple(k.value for k in PassiveKind)]  # type: ignore[valid-type]
StatName = Literal["attack", "defense", "speed", "crit_rate"]
TargetTypeV = Literal[tuple(t.value for t in TargetType)]  # type: ignore[valid-type]
LaneScopeV = Literal[tuple(s.value for s in LaneScope)]  # type: ignore[valid-type]
FactionV = Literal[tuple(f.value for f in Faction)]  # type: ignore[valid-type]
RarityV = Literal[tuple(r.value for r in Rarity)]  # type: ignore[valid-type]
RoleV = Literal[tuple(r.value for r in Role)]  # type: ignore[valid-type]
GambitConditionV = Literal[tuple(c.value for c in GambitCondition)]  # type: ignore[valid-type]
EnemyRole = Literal["troop", "elite", "boss"]
ArtifactSetV = Literal["Hyper-Thrusters", "Bio-Leech", "Psionic Aegis", "Gauss Overcharge", "Precision Matrix"]


class _Strict(BaseModel):
    # Unknown keys are errors (catches typos); "$schema" is allowed for editor support.
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_ref: Optional[str] = Field(None, alias="$schema", description="Editor hint, ignored by the game.")


class Effect(_Strict):
    """A buff / debuff an ability or passive applies, or an op (CLEANSE / STRIP / STEAL)."""
    type: EffectKind
    target: EffectTarget = Field("hit", description="self | ally (healed/chosen ally) | allies (all allies in reach) | hit (enemies damaged) | enemies (all enemies in reach)")
    value: float = Field(0.0, description="Strength: 0.3 = 30% (stat effects / MARKED) or 30% max HP per turn (BURN/POISON/REGEN).")
    turns: int = Field(2, ge=0, description="Duration in the holder's own turns.")
    chance: float = Field(1.0, ge=0, le=1, description="Base land chance for debuffs (Accuracy vs Resistance applies).")
    count: int = Field(1, ge=0, description="CLEANSE / STRIP / STEAL: number of effects affected.")


class Passive(_Strict):
    id: str
    name: str
    description: str = ""
    kind: PassiveKindV
    stat: Optional[StatName] = None
    value: float = 0.0
    max_stacks: int = 0
    threshold: float = Field(0.0, description="LOW_HP: HP ratio below which it triggers.")
    lane_wide: bool = Field(False, description="REGEN: heal the whole lane instead of self.")
    effect: Optional[Effect] = None


class Ability(_Strict):
    """A hero / enemy / boss ability (CombatCard)."""
    id: str
    name: str
    description: str = ""
    target_type: TargetTypeV = "single_enemy"
    lane_scope: LaneScopeV = "same_lane"
    power_multiplier: float = Field(1.0, ge=0, description="Damage = attack × this.")
    heal_multiplier: float = Field(0.0, ge=0, description="Heal = attack × this.")
    shield_grant: int = Field(0, ge=0)
    cooldown_turns: int = Field(0, ge=0, description="Own turns before it can be used again.")
    summon_troop_id: Optional[str] = Field(None, description="Troop template summoned into the target lane.")
    effects: List[Effect] = Field(default_factory=list)
    telegraph_turns: int = Field(0, ge=0, description="Bosses: own turns spent winding up before it lands.")
    phase: int = Field(0, ge=0, description="Bosses: 0-based phase from which it is unlocked.")
    energy_cost: int = Field(0, ge=0, description="Legacy card mode only.")
    icon_name: str = "Zap"
    flavor_quote: Optional[str] = None


class Stats(_Strict):
    hp: int = Field(..., gt=0)
    shields: int = Field(0, ge=0)
    attack: int = Field(..., ge=0)
    defense: int = Field(..., ge=0)
    speed: int = Field(..., gt=0)
    crit_rate: float = Field(0.10, ge=0, le=1)
    crit_damage: float = Field(1.5, ge=1)
    accuracy: int = 10
    resistance: int = 30


class Gambit(_Strict):
    priority: int
    condition: GambitConditionV
    card_id: str


class Hero(_Strict):
    """A playable champion template. Owned copies pick up changes on the next load."""
    id: str = Field(..., description="Template id, e.g. tmpl_terran_raynor. Never rename once players own it.")
    name: str
    title: str
    faction: FactionV
    role: RoleV
    rarity: RarityV
    stats: Stats = Field(..., description="Level 1 / rank 1 stats; level & rank growth apply on top.")
    passive: Optional[Passive] = None
    abilities: List[Ability] = Field(..., min_length=1)
    gambits: List[Gambit] = Field(default_factory=list, description="Default auto-play rules (players can edit their own).")
    avatar_color: str = "#3b82f6"
    avatar_icon: str = "Shield"
    order: int = Field(100, description="Display / listing order (lower first).")


class Troop(_Strict):
    """A troop pack heroes lead (or summon). Pack HP = count × unit_hp."""
    id: str
    name: str
    faction: FactionV
    count: int = Field(..., gt=0)
    unit_hp: int = Field(..., gt=0)
    unit_attack: int = Field(..., ge=0)
    defense: int = Field(..., ge=0)
    description: str = ""
    icon_name: str = "Users"


class Summon(_Strict):
    """An enemy-side summonable pack (scaled with the encounter)."""
    name: str
    count: int = Field(..., gt=0)
    unit_hp: int = Field(..., gt=0)
    unit_attack: int = Field(..., ge=0)
    defense: int = 5


class Enemy(_Strict):
    """
    A hostile prototype. Non-elite entries fight as troop packs; elites (and difficulty
    "elite"/"boss" threats) fight as enemy heroes with abilities.
    """
    name: str
    hp: int = Field(..., gt=0)
    shields: int = Field(0, ge=0)
    attack: int = Field(..., ge=0)
    defense: int = Field(..., ge=0)
    speed: int = Field(100, gt=0)
    is_elite: bool = False
    role: Optional[EnemyRole] = Field(None, description="Difficulty threats only: troop / elite / boss.")
    min_tier: int = Field(1, ge=1, le=10, description="Difficulty threats only: first tier it appears.")
    passive: Optional[Passive] = None
    cards: List[Ability] = Field(default_factory=list)
    summons: Dict[str, Summon] = Field(default_factory=dict)


class Planet(_Strict):
    """A planet (biome): expedition setting, enemy pool and difficulty threats."""
    id: str
    name: str
    description: str
    hazard_name: str
    hazard_description: str
    recommended_power: int
    allowed_artifact_sets: List[ArtifactSetV]
    color: str
    bg_gradient: str
    icon_name: str
    max_difficulty: int = Field(1, ge=1, le=10)
    order: int = Field(100, description="Position on the Sector Map (lower first).")
    enemy_pool: List[Enemy] = Field(..., min_length=1)
    difficulty_enemies: List[Enemy] = Field(default_factory=list)


class PhaseSummon(_Strict):
    template_id: str
    lanes: List[int]


class Phase(_Strict):
    threshold: float = Field(..., ge=0, le=1, description="HP ratio that triggers the phase (first phase: 1.0).")
    name: str
    description: str = ""
    bonus: Dict[StatName, float] = Field(default_factory=dict, description="Stat % bonuses while in this phase.")
    effects: List[Effect] = Field(default_factory=list, description="Applied to the boss on entering the phase.")
    summons: List[PhaseSummon] = Field(default_factory=list)
    shield_pct: float = Field(0.0, ge=0, description="Shield gained on entering, as a share of max HP.")


class Boss(_Strict):
    """A colossal boss spanning all three lanes, optionally part of a planet hierarchy."""
    id: str
    name: str
    title: str
    description: str
    planet: str = Field(..., description="Planet id: arena and loot table.")
    arena_name: str
    image: str = "/assets/bosses/zargul.svg"
    art_hue: int = 0
    color: str = "#ef4444"
    recommended_power: int
    stats: Stats
    max_difficulty: int = Field(10, ge=1, le=10)
    passive: Optional[Passive] = None
    abilities: List[Ability] = Field(..., min_length=1)
    phases: List[Phase] = Field(..., min_length=1)
    summons: Dict[str, Summon] = Field(default_factory=dict)
    rewards: Dict[str, int] = Field(default_factory=dict, description="Base credits / crystals at difficulty 1.")
    # Hierarchy
    rank: Optional[Literal["CAPTAIN", "LIEUTENANT", "OVERLORD"]] = None
    superior: Optional[str] = Field(None, description="Boss id this champion answers to.")
    influence_required: int = Field(0, ge=0)
    guard: Optional[Enemy] = Field(None, description="Elite that defends expeditions targeting this champion.")
    recruit_template_id: Optional[str] = Field(None, description="Not used yet: hero template granted when claimed.")
    claim_bonus: Dict[str, float] = Field(default_factory=dict, description="Not used yet: seat bonus when claimed.")


# Content kinds: folder name -> model.
CONTENT_KINDS = {"heroes": Hero, "troops": Troop, "planets": Planet, "bosses": Boss}
