import random

import pytest
from fastapi.testclient import TestClient

from src.domain.entities.battle import Battle, LaneUnit, Objective, Wave
from src.domain.entities.expedition_run import ExpeditionRun, MapNode
from src.domain.services.expedition_run_service import ExpeditionRunService
from src.domain.services.lane_battle_engine import LaneBattleEngine
from src.domain.services.map_generator import MAP_ROWS, MapGenerator
from src.domain.value_objects.card import CombatCard
from src.domain.value_objects.enums import (
    BattleStatus,
    LaneScope,
    NodeType,
    ObjectiveType,
    RunStatus,
    Side,
    TargetType,
    UnitKind,
)
from src.domain.value_objects.troop import TroopTemplate
from src.infrastructure.database.seed_data import get_seed_biomes
from src.main import app

MARINES = TroopTemplate("troop_marine", "Marine Squad", "Terran Vanguard", count=6, unit_hp=35, unit_attack=6, defense=12)
GRUNTS = TroopTemplate("grunt", "Grunts", "Hostile", count=4, unit_hp=20, unit_attack=4, defense=0)


def hero(uid="h1", lane=1, side=Side.ALLY, cards=None, attack=50, hp=300, speed=100):
    return LaneUnit(
        id=uid, kind=UnitKind.HERO, side=side, name=uid, hp=hp, max_hp=hp,
        attack=attack, defense=10, speed=speed, crit_rate=0.0, lane=lane, cards=cards or [],
    )


def pack(uid, template, side, lane):
    return LaneUnit.troop_from_template(uid, template, side, lane=lane)


CLEAR_ALL = [Objective(ObjectiveType.CLEAR_LANES, True, "Clear 3", {"count": 3})]


def make_battle(units, objectives=None, waves=None):
    return Battle(
        id="b1", node_id="n1_0", status=BattleStatus.DEPLOYMENT, units=units,
        objectives=objectives or [Objective(ObjectiveType.CLEAR_LANES, True, "Clear 2", {"count": 2})],
        waves=waves or [],
    )


# ── Troop packs ─────────────────────────────────────────────────────────────
def test_troop_pack_count_tracks_casualties():
    p = pack("p", MARINES, Side.ALLY, 0)
    assert p.count == 6 and p.volley_power == 36
    p.hp -= 36  # one full soldier + a wounded one
    assert p.count == 5
    assert p.volley_power == 30


def test_troops_screen_their_hero():
    enemy_hero = hero("eh", side=Side.ENEMY)
    enemy_pack = pack("ep", GRUNTS, Side.ENEMY, 1)
    battle = make_battle([hero(), enemy_hero, enemy_pack])
    assert battle.front_target(Side.ALLY, 1).id == "ep"
    enemy_pack.is_alive = False
    assert battle.front_target(Side.ALLY, 1).id == "eh"


# ── Engine ──────────────────────────────────────────────────────────────────
def test_hero_turn_triggers_lane_volley_only_in_its_lane():
    rng = random.Random(1)
    engine = LaneBattleEngine(rng)
    ally = hero("h1", lane=0, speed=200)
    ally_pack = pack("ap", MARINES, Side.ALLY, 0)
    left_enemy = pack("e0", GRUNTS, Side.ENEMY, 0)
    right_enemy = pack("e2", GRUNTS, Side.ENEMY, 2)
    battle = make_battle([ally, ally_pack, left_enemy, right_enemy])
    engine.begin(battle, now=0)
    assert battle.current_actor_id == "h1"

    engine.play_ally_turn(battle, card_id=None, now=0)  # basic attack + lane 0 volley
    assert not left_enemy.is_alive
    assert right_enemy.hp == right_enemy.max_hp  # troops never leave their lane


def test_all_lanes_ability_hits_every_lane():
    engine = LaneBattleEngine(random.Random(2))
    barrage = CombatCard("barrage", "Barrage", "", 1, TargetType.ALL_ENEMIES, 0.5, lane_scope=LaneScope.ALL_LANES)
    ally = hero("h1", lane=1, cards=[barrage], speed=300)
    enemies = [pack(f"e{l}", MARINES, Side.ENEMY, l) for l in range(3)]
    battle = make_battle([ally, *enemies])
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="barrage", now=0)
    assert all(e.hp < e.max_hp for e in enemies)


def test_any_lane_ability_uses_chosen_lane_and_summons():
    engine = LaneBattleEngine(random.Random(3))
    drop = CombatCard("drop", "Drop", "", 2, TargetType.SELF, 0.0, cooldown_turns=3,
                      lane_scope=LaneScope.ANY_LANE, summon_troop_id="troop_marine")
    ally = hero("h1", lane=1, cards=[drop], speed=300)
    battle = make_battle([ally, pack("e0", MARINES, Side.ENEMY, 0), pack("e2", MARINES, Side.ENEMY, 2)])
    battle.summon_templates = {"troop_marine": MARINES}
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="drop", target_lane=2, now=0)
    summoned = [u for u in battle.units if u.id.startswith("sum_")]
    assert len(summoned) == 1 and summoned[0].lane == 2 and summoned[0].owner_id == "h1"
    assert ally.cooldowns["drop"] == 3


def test_cooldown_blocks_replay():
    engine = LaneBattleEngine(random.Random(4))
    card = CombatCard("big", "Big", "", 1, TargetType.SINGLE_ENEMY, 0.1, cooldown_turns=2)
    ally = hero("h1", cards=[card], speed=300)
    battle = make_battle([ally, hero("eh", side=Side.ENEMY, hp=5000, speed=1)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="big", now=0)
    with pytest.raises(ValueError):
        engine.play_ally_turn(battle, card_id="big", now=0)


def test_clear_two_lanes_wins_even_if_third_lane_contested():
    engine = LaneBattleEngine(random.Random(5))
    ally = hero("h1", lane=2, attack=1, speed=1)
    battle = make_battle([ally, pack("e2", MARINES, Side.ENEMY, 2)])
    engine.begin(battle, now=0)
    assert battle.status == BattleStatus.WON  # lanes 0 and 1 are empty and have no waves


def test_pending_wave_keeps_lane_uncleared_then_spawns():
    engine = LaneBattleEngine(random.Random(6))
    ally = hero("h1", lane=0, speed=300, attack=500)
    wave = Wave(turn=1, lane=1, units=[pack("w1", GRUNTS, Side.ENEMY, None)])
    battle = make_battle([ally, pack("e0", GRUNTS, Side.ENEMY, 0), pack("e2", GRUNTS, Side.ENEMY, 2)], waves=[wave])
    engine.begin(battle, now=0)
    assert not battle.is_lane_cleared(1)
    engine.play_ally_turn(battle, now=0)
    assert wave.spawned
    assert battle.get_unit("w1").lane == 1


def test_defend_lane_fails_when_lane_wiped():
    engine = LaneBattleEngine(random.Random(7))
    ally = hero("h1", lane=0, speed=1)
    guard = pack("g", GRUNTS, Side.ALLY, 2)
    guard.hp = 1
    brute = hero("brute", lane=2, side=Side.ENEMY, attack=500, speed=400)
    battle = make_battle(
        [ally, guard, brute, pack("e0", MARINES, Side.ENEMY, 0)],
        objectives=[
            Objective(ObjectiveType.CLEAR_LANES, True, "Clear 3", {"count": 3}),
            Objective(ObjectiveType.DEFEND_LANE, False, "Hold right", {"lane": 2}),
        ],
    )
    engine.begin(battle, now=0)
    assert battle.status == BattleStatus.LOST
    assert battle.objectives[1].status == "FAILED"


def test_timeout_falls_back_to_gambit():
    engine = LaneBattleEngine(random.Random(8))
    ally = hero("h1", speed=300)
    battle = make_battle([ally, hero("eh", side=Side.ENEMY, hp=5000, speed=1)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    assert battle.is_turn_timed_out(now=100)
    engine.play_ally_turn(battle, timed_out=True, now=100)
    assert any("Decision window expired" in line for line in battle.log)


# ── Map ─────────────────────────────────────────────────────────────────────
def test_map_every_node_reachable_and_ends_on_boss():
    nodes = MapGenerator(random.Random(9)).generate()
    by_id = {n.id: n for n in nodes}
    reached, frontier = {"n0_1"}, ["n0_1"]
    while frontier:
        for nxt in by_id[frontier.pop()].next_ids:
            if nxt not in reached:
                reached.add(nxt)
                frontier.append(nxt)
    assert reached == set(by_id)
    bosses = [n for n in nodes if n.type == NodeType.BOSS]
    assert len(bosses) == 1 and bosses[0].row == MAP_ROWS - 1


# ── Run persistence ─────────────────────────────────────────────────────────
def test_losses_persist_between_nodes():
    rng = random.Random(10)
    service = ExpeditionRunService(rng=rng)
    biome = get_seed_biomes()[2]
    h = hero("h1", lane=None, attack=400, speed=300)
    my_pack = pack("tp", MARINES, Side.ALLY, None)
    my_pack.owner_id = "h1"
    node = MapNode("n1_1", 1, 1, NodeType.COMBAT, threat=1)
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"], visited=True), node],
        current_node_id="n0_1", heroes=[h], troops=[my_pack],
    )
    service.choose_node(run, biome, "n1_1", {})
    assert run.status == RunStatus.DEPLOYMENT
    service.deploy(run, {"h1": 1}, now=0)
    guard = 0
    while run.status == RunStatus.BATTLE and guard < 200:
        guard += 1
        if run.battle.current_actor_id:
            service.play(run, None, None, now=0)
        else:
            service.tick(run, now=0)
    assert run.status in (RunStatus.MAP, RunStatus.DEFEAT)
    # Damage taken in the battle is still on the persistent roster objects
    assert h.lane is None
    if run.status == RunStatus.MAP:
        assert run.rewards["credits"] > 0
        assert h.hp < h.max_hp or my_pack.hp < my_pack.max_hp or not my_pack.is_alive


def test_rest_node_heals_and_regroups():
    service = ExpeditionRunService(rng=random.Random(11))
    biome = get_seed_biomes()[0]
    h = hero("h1", lane=None)
    h.hp = 100
    tp = pack("tp", MARINES, Side.ALLY, None)
    tp.owner_id = "h1"
    tp.hp = 10
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"]), MapNode("n1_1", 1, 1, NodeType.REST)],
        current_node_id="n0_1", heroes=[h], troops=[tp],
    )
    service.choose_node(run, biome, "n1_1", {})
    assert h.hp == 100 + int(300 * 0.35)
    assert tp.hp == 10 + int((tp.max_hp - 10) * 0.5)
    assert run.status == RunStatus.MAP


# ── API ─────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_run_api_flow(client):
    client.post("/api/runs/active/abandon")
    client.delete("/api/runs/active")

    catalog = client.get("/api/runs/troops").json()
    assert catalog["troops_per_hero"] == 2 and len(catalog["templates"]) == 6

    res = client.post("/api/runs/start", json={"biome_id": "biome_mar_sara", "squad_id": "squad_alpha"})
    assert res.status_code == 200, res.text
    run = res.json()
    assert run["status"] == "MAP"
    assert run["troops"], "heroes get default troops"
    assert client.post("/api/runs/start", json={"biome_id": "biome_char"}).status_code == 400

    # walk until a battle node
    for _ in range(8):
        if run["status"] != "MAP":
            break
        nxt = {n["id"]: n for n in run["nodes"]}
        choice = next((i for i in run["reachable_node_ids"] if nxt[i]["type"] in ("COMBAT", "ELITE", "BOSS")),
                      run["reachable_node_ids"][0])
        run = client.post("/api/runs/active/node", json={"node_id": choice}).json()
    assert run["status"] == "DEPLOYMENT"
    assert run["battle"]["objectives"]

    living = [h for h in run["heroes"] if h["is_alive"]][:3]
    bad = client.post("/api/runs/active/deploy", json={"assignments": {living[0]["id"]: 1, living[1]["id"]: 1}})
    assert bad.status_code == 400  # max 1 hero per lane

    run = client.post("/api/runs/active/deploy", json={"assignments": {h["id"]: i for i, h in enumerate(living)}}).json()
    assert run["status"] in ("BATTLE", "MAP", "DEFEAT")
    if run["status"] == "BATTLE" and run["battle"]["current_actor_id"]:
        actor = next(u for u in run["battle"]["units"] if u["id"] == run["battle"]["current_actor_id"])
        card = next(c for c in actor["cards"] if c["cooldown_remaining"] == 0)
        after = client.post("/api/runs/active/ability", json={"card_id": card["id"], "target_lane": 0}).json()
        assert after["battle"]["turn"] > run["battle"]["turn"]

    final = client.post("/api/runs/active/abandon").json()
    assert final["status"] in ("ABANDONED", "DEFEAT", "VICTORY")
    assert final["rewards_paid"] is True
    assert client.delete("/api/runs/active").status_code == 200


# ── Unit targeting ──────────────────────────────────────────────────────────
def test_single_target_hits_chosen_unit_through_screen():
    engine = LaneBattleEngine(random.Random(12))
    snipe = CombatCard("snipe", "Snipe", "", 1, TargetType.SINGLE_ENEMY, 1.0, lane_scope=LaneScope.ANY_LANE)
    ally = hero("h1", lane=1, cards=[snipe], speed=300)
    screen = pack("screen", MARINES, Side.ENEMY, 2)
    behind = hero("eh", lane=2, side=Side.ENEMY, hp=5000, speed=1)
    battle = make_battle([ally, screen, behind, pack("e0", MARINES, Side.ENEMY, 0)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="snipe", target_unit_id="eh", now=0)
    assert behind.hp < behind.max_hp
    assert screen.hp == screen.max_hp


def test_unit_target_out_of_reach_or_wrong_side_rejected():
    engine = LaneBattleEngine(random.Random(13))
    shot = CombatCard("shot", "Shot", "", 1, TargetType.SINGLE_ENEMY, 1.0)  # same lane only
    ally = hero("h1", lane=0, cards=[shot], speed=300)
    far = pack("far", MARINES, Side.ENEMY, 2)
    battle = make_battle([ally, far, pack("e0", MARINES, Side.ENEMY, 0)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    with pytest.raises(ValueError, match="out of reach"):
        engine.play_ally_turn(battle, card_id="shot", target_unit_id="far", now=0)
    with pytest.raises(ValueError, match="enemy"):
        engine.play_ally_turn(battle, card_id="shot", target_unit_id="h1", now=0)


def test_heal_can_target_chosen_ally():
    engine = LaneBattleEngine(random.Random(14))
    heal = CombatCard("heal", "Heal", "", 1, TargetType.LOWEST_HP_ALLY, 0.0, heal_multiplier=1.0,
                      lane_scope=LaneScope.ADJACENT_LANES)
    medic = hero("medic", lane=1, cards=[heal], speed=300)
    hurt_most = pack("p0", MARINES, Side.ALLY, 0)
    hurt_most.hp = 10
    chosen = pack("p2", MARINES, Side.ALLY, 2)
    chosen.hp = 100
    battle = make_battle([medic, hurt_most, chosen, hero("eh", side=Side.ENEMY, hp=5000, speed=1)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="heal", target_unit_id="p2", now=0)
    assert chosen.hp == 150 and hurt_most.hp == 10
