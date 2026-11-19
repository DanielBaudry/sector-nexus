# Game content

Everything you design lives here as JSON — one file per unit:

| Folder | What | Key fields |
|---|---|---|
| `heroes/` | Playable champions | `stats`, `passive`, `abilities`, `gambits`, `order` |
| `troops/` | Troop packs: trained in the Barracks, brought as expedition reserve (deployed with mana) / hero summons | `count`, `unit_hp`, `unit_attack`, `defense`, `mana_cost`, `cost`, `requires` |
| `upgrades/` | Barracks tech tree: structures (unlock troops) and researches (faction troop bonuses) | `faction`, `kind`, `cost`, `requires`, `bonus`, `order` |
| `planets/` | Planets: expedition setting, enemy pool, difficulty threats | `enemy_pool`, `difficulty_enemies`, `max_difficulty`, `order`, `image`, `battle_image` |
| `bosses/` | Colossal bosses and planet hierarchies | `stats`, `abilities`, `phases`, `summons`, `rank`, `superior`, `influence_required`, `guard` |
| `schema/` | JSON Schemas (generated — don't edit by hand) | |

## Editing

- Open a file in VS Code: the `"$schema"` line gives autocomplete, hover docs and red squiggles
  for unknown keys or bad values (e.g. `"target_type"` only accepts the real targets).
- Save — the backend **reloads automatically**, no restart. The next API call uses the new data.
- Owned heroes update too: a champion's stats, abilities and passive always come from its hero
  file; the player's level, rank, XP, gear and gambits are kept.
- **Never rename a hero `id`** once players own it (that's how owned copies find their file).
  Renaming an ability `id` is fine; gambits pointing at a missing ability fall back to the defaults.

## Validation

Bad content fails loudly with the file and the problem, e.g.

```
heroes/terran_raynor.json: abilities.0.target_type: Input should be 'single_enemy', 'all_enemies', ...
heroes/terran_raynor: gambit references unknown ability 'nope'.
bosses/skarn: unknown superior 'boss_nobody'.
```

Cross-checks: unique ids, gambit → ability, ability summon → troop (heroes) or own `summons`
(enemies / bosses), boss → planet / superior (same planet, no loops), phases start at 1.0 and go
down, phase-locked abilities exist in a real phase, summon lanes 0–2.

Quick check without starting the server:

```
cd backend && PYTHONPATH=. python -c "from src.infrastructure.content.library import ContentLibrary, content_dir; ContentLibrary.load(content_dir()); print('content OK')"
```

## Reference

- **Ability** — `target_type`: `single_enemy | all_enemies | self | all_allies | lowest_hp_ally`;
  `lane_scope`: `same_lane | adjacent_lanes | any_lane | all_lanes`; damage = attack × `power_multiplier`,
  heal = attack × `heal_multiplier`; `cooldown_turns` in own turns; heroes: `mana_gain` (player mana per use). Bosses: `telegraph_turns`
  (wind-up, a stun interrupts it) and `phase` (0-based unlock phase).
- **Effect** — buffs `ATK_UP DEF_UP SPD_UP CRIT_UP IMMUNITY REGEN`, debuffs
  `ATK_DOWN DEF_DOWN SPD_DOWN BURN POISON STUN HEAL_BLOCK MARKED`, ops `CLEANSE STRIP STEAL`.
  `target`: `self | ally | allies | hit | enemies`; `value` 0.3 = 30%; `turns` = holder's turns;
  `chance` = base land chance (Accuracy vs Resistance applies); `count` for ops.
- **Passive** — `kind`: `STACK_ON_TURN_END PER_ALLY_TROOP LOW_HP LANE_AURA REGEN SHIELD_REGEN
  ON_KILL_METER ON_HIT_EFFECT DAMAGE_VS_DEBUFFED BATTLE_START_EFFECT` with `stat`, `value`,
  `max_stacks`, `threshold`, `lane_wide`, `effect` as relevant.

## Changing the schema itself

The models are in `backend/src/infrastructure/content/schema.py`. After changing them, regenerate
the JSON Schemas:

```
cd backend && PYTHONPATH=. python scripts/export_content_schema.py
```
