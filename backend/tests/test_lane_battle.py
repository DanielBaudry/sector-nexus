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
    my_pack.deployed_lane = 1  # deployed in an earlier battle: starts on the field
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
    while run.status == RunStatus.BATTLE and guard < 2000:
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
    assert catalog["reserve_size"] == 6 and len(catalog["templates"]) == 6
    assert all(t["mana_cost"] > 0 for t in catalog["templates"])
    too_many = client.post("/api/runs/start", json={"biome_id": "biome_mar_sara", "troop_ids": ["troop_marine"] * 7})
    assert too_many.status_code == 400

    barracks = client.get("/api/barracks").json()
    if not next(t for t in barracks["troops"] if t["id"] == "troop_marine")["owned"] >= 2:
        client.post("/api/player/resupply")
        client.post("/api/barracks/research", json={"upgrade_id": "terran_barracks"})  # fresh account: build it first
        assert client.post("/api/barracks/train", json={"template_id": "troop_marine", "quantity": 2}).status_code == 200
    owned_before = next(t for t in client.get("/api/barracks").json()["troops"] if t["id"] == "troop_marine")["owned"]
    res = client.post("/api/runs/start", json={
        "biome_id": "biome_mar_sara", "squad_id": "squad_alpha", "troop_ids": ["troop_marine", "troop_marine"],
    })
    assert res.status_code == 200, res.text
    run = res.json()
    assert run["status"] == "MAP"
    assert len(run["troops"]) == 2, "packs come from the garrison"
    owned_now = next(t for t in client.get("/api/barracks").json()["troops"] if t["id"] == "troop_marine")["owned"]
    assert owned_now == owned_before - 2
    assert all(t["deployed_lane"] is None for t in run["troops"])
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
        assert run["mana"] >= 3
        cheapest = min(run["troops"], key=lambda t: t["mana_cost"])
        deployed = client.post("/api/runs/active/troops/deploy", json={"troop_id": cheapest["id"], "lane": 2})
        assert deployed.status_code == 200, deployed.text
        run = deployed.json()
        assert run["mana"] == run["battle"]["mana"]
        assert any(u["id"] == cheapest["id"] and u["lane"] == 2 for u in run["battle"]["units"])
        again = client.post("/api/runs/active/troops/deploy", json={"troop_id": cheapest["id"], "lane": 0})
        assert again.status_code == 400  # deployed packs cannot be redeployed
        actor = next(u for u in run["battle"]["units"] if u["id"] == run["battle"]["current_actor_id"])
        card = next(c for c in actor["cards"] if c["cooldown_remaining"] == 0)
        after = client.post("/api/runs/active/ability", json={"card_id": card["id"], "target_lane": 0}).json()
        assert after["battle"]["turn"] > run["battle"]["turn"]

    final = client.post("/api/runs/active/abandon").json()
    assert final["status"] in ("ABANDONED", "DEFEAT", "VICTORY")
    assert final["rewards_paid"] is True
    if final["status"] == "ABANDONED":  # survivors return to the barracks
        survivors = sum(1 for t in final["troops"] if t["is_alive"])
        back = next(t for t in client.get("/api/barracks").json()["troops"] if t["id"] == "troop_marine")["owned"]
        assert back == owned_now + survivors
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


# ── Step-wise resolution & events ───────────────────────────────────────────
def test_events_describe_hits_and_tick_resolves_one_action():
    rng = random.Random(15)
    service = ExpeditionRunService(rng=rng)
    biome = get_seed_biomes()[0]
    h = hero("h1", lane=None, attack=60, speed=40)
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"]), MapNode("n1_1", 1, 1, NodeType.ELITE, threat=1)],
        current_node_id="n0_1", heroes=[h], troops=[],
    )
    service.choose_node(run, biome, "n1_1", {})
    service.deploy(run, {"h1": 1}, now=0)
    battle = run.battle
    turns_before = battle.turn
    if not battle.current_actor_id:
        service.tick(run, now=0)
        assert battle.turn - turns_before <= 1
    for _ in range(30):
        if run.status != RunStatus.BATTLE:
            break
        if battle.current_actor_id:
            service.play(run, None, None, now=0)
        else:
            service.tick(run, now=0)
    hits = [e for e in battle.events if e["type"] == "hit"]
    assert hits, "combat should emit hit events"
    e = hits[-1]
    assert {"source_id", "target_id", "damage", "hp", "alive", "crit"} <= set(e)
    seqs = [ev["seq"] for ev in battle.events]
    assert seqs == sorted(seqs)


# ── Mana & troop reserve ────────────────────────────────────────────────────
def _battle_run(service, troops, mana=0):
    biome = get_seed_biomes()[2]
    h = hero("h1", lane=None, attack=60, hp=5000, speed=300)
    node = MapNode("n1_1", 1, 1, NodeType.COMBAT, threat=1)
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"], visited=True), node],
        current_node_id="n0_1", heroes=[h], troops=troops, mana=mana,
    )
    service.choose_node(run, biome, "n1_1", {})
    service.deploy(run, {"h1": 1}, now=0)
    return run


def _wait_for_turn(service, run):
    for _ in range(500):
        if run.status != RunStatus.BATTLE or run.battle.current_actor_id:
            return
        service.tick(run, now=0)


def test_battle_opens_with_mana_floor_and_keeps_reserve_off_field():
    service = ExpeditionRunService(rng=random.Random(20))
    reserve = pack("tp", MARINES, Side.ALLY, None)
    run = _battle_run(service, [reserve], mana=1)
    assert run.battle.mana == 3  # floor
    assert reserve not in run.battle.units and reserve.lane is None
    rich = _battle_run(ExpeditionRunService(rng=random.Random(20)), [], mana=8)
    assert rich.battle.mana == 8


def test_deploy_troop_spends_mana_and_holds_lane():
    service = ExpeditionRunService(rng=random.Random(21))
    reserve = pack("tp", MARINES, Side.ALLY, None)
    reserve.mana_cost = 3
    run = _battle_run(service, [reserve], mana=5)
    _wait_for_turn(service, run)
    assert run.battle.current_actor_id
    mana = run.battle.mana
    service.deploy_troop(run, "tp", 0)
    assert run.battle.mana == mana - 3
    assert reserve.lane == 0 and reserve.deployed_lane == 0 and reserve in run.battle.units
    assert any(e["type"] == "summon" and e.get("deploy") for e in run.battle.events)
    with pytest.raises(ValueError, match="reserve"):
        service.deploy_troop(run, "tp", 1)


def test_deploy_troop_needs_mana_and_player_turn():
    service = ExpeditionRunService(rng=random.Random(22))
    costly = pack("big", MARINES, Side.ALLY, None)
    costly.mana_cost = 9
    run = _battle_run(service, [costly], mana=0)
    _wait_for_turn(service, run)
    with pytest.raises(ValueError, match="mana"):
        service.deploy_troop(run, "big", 1)
    run.battle.current_actor_id = None
    with pytest.raises(ValueError, match="your turn"):
        service.deploy_troop(run, "big", 1)


def test_kills_lanes_and_objectives_grant_mana_capped():
    engine = LaneBattleEngine(random.Random(23))
    blast = CombatCard("blast", "Blast", "", 1, TargetType.ALL_ENEMIES, 50.0, lane_scope=LaneScope.ALL_LANES)
    ally = hero("h1", lane=1, cards=[blast], speed=300, attack=500)
    foes = [pack("e0", GRUNTS, Side.ENEMY, 0), pack("e1", GRUNTS, Side.ENEMY, 1), hero("eh", lane=2, side=Side.ENEMY, hp=50, speed=1)]
    battle = make_battle([ally, *foes], objectives=[Objective(ObjectiveType.CLEAR_LANES, True, "Clear 3", {"count": 3})])
    engine.begin(battle, now=0)
    assert battle.mana == 0
    engine.play_ally_turn(battle, card_id="blast", now=0)
    # 2 troop kills (+1 each), 1 hero kill (+2), 3 lanes cleared (+1 each), objective (+2) = 9
    assert battle.mana == 9
    assert battle.status == BattleStatus.WON
    battle.gain_mana(5, "test")
    assert battle.mana == battle.mana_cap


def test_ability_mana_gain_and_carry_over_between_battles():
    engine = LaneBattleEngine(random.Random(24))
    focus = CombatCard("focus", "Focus", "", 1, TargetType.SELF, 0.0, mana_gain=2)
    ally = hero("h1", lane=1, cards=[focus], speed=300)
    battle = make_battle([ally, hero("eh", lane=1, side=Side.ENEMY, hp=5000, speed=1)], objectives=CLEAR_ALL)
    engine.begin(battle, now=0)
    engine.play_ally_turn(battle, card_id="focus", now=0)
    assert battle.mana == 2

    service = ExpeditionRunService(rng=random.Random(25))
    reserve = pack("tp", MARINES, Side.ALLY, None)
    reserve.mana_cost = 2
    run = _battle_run(service, [reserve], mana=4)
    _wait_for_turn(service, run)
    service.deploy_troop(run, "tp", 1)
    service.abandon(run)
    assert run.mana == run.battle.mana
    assert reserve.lane is None and reserve.deployed_lane == 1


# ── Warp Beacon loot ────────────────────────────────────────────────────────
def test_archive_node_loot_and_defeat_payout_share():
    service = ExpeditionRunService(rng=random.Random(30))
    biome = get_seed_biomes()[0]
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"]), MapNode("n1_1", 1, 1, NodeType.ARCHIVE)],
        current_node_id="n0_1", heroes=[hero("h1", lane=None)],
        hero_pool={"tmpl_a": "Alpha", "tmpl_b": "Beta"}, known_blueprints=["tmpl_a"],
    )
    service.choose_node(run, biome, "n1_1", {})
    mats = run.rewards["hero_materials"]
    assert mats and all(t in run.hero_pool for t in mats)
    assert set(run.rewards.get("blueprints", [])) <= {"tmpl_b"}
    assert "warp archive" in run.log[-1]

    run.rewards["hero_materials"] = {"tmpl_a": 41}
    run.rewards["blueprints"] = ["tmpl_b", "tmpl_c"]
    run.status = RunStatus.DEFEAT
    payout = service.finalize_payout(run)
    assert payout["hero_materials"] == {"tmpl_a": 20}
    assert len(payout["blueprints"]) == 1


def test_non_combat_nodes_report_an_event():
    service = ExpeditionRunService(rng=random.Random(31))
    biome = get_seed_biomes()[0]
    h = hero("h1", lane=None)
    h.hp = 100
    run = ExpeditionRun(
        id="r", biome_id=biome.id, biome_name=biome.name, squad_id="s", status=RunStatus.MAP,
        nodes=[MapNode("n0_1", 0, 1, NodeType.START, next_ids=["n1_1"]), MapNode("n1_1", 1, 1, NodeType.REST, next_ids=["n2_1"]),
               MapNode("n2_1", 2, 1, NodeType.CACHE)],
        current_node_id="n0_1", heroes=[h],
    )
    service.choose_node(run, biome, "n1_1", {})
    ev = run.node_event
    assert ev["type"] == "REST" and ev["seq"] == 1
    assert ev["healed"][0]["before"] == 100 and ev["healed"][0]["after"] == h.hp
    service.choose_node(run, biome, "n2_1", {})
    assert run.to_dict()["node_event"]["type"] == "CACHE" and run.node_event["seq"] == 2
    assert run.node_event["loot"]["credits"] > 0 and run.node_event["mana"] == 2


def test_turn_meters_start_empty_every_battle():
    engine = LaneBattleEngine(random.Random(40))
    ally = hero("h1", lane=1, speed=100)
    ally.turn_meter = 140.0  # left over from a previous fight
    foe = hero("eh", lane=1, side=Side.ENEMY, hp=5000, speed=100)
    foe.turn_meter = 90.0
    battle = make_battle([ally, foe, pack("e0", MARINES, Side.ENEMY, 0)], objectives=CLEAR_ALL)
    battle.drill_meters = {"ENEMY:0": 77.0}
    engine.begin(battle, now=0, max_actions=0)
    # Same speed, empty meters: both fill together and the ally (tie-break) gets the first turn.
    assert battle.current_actor_id == "h1"
    assert foe.turn_meter == ally.turn_meter
    # A stale 77 would have filled first and fired before the ally: it was cleared.
    assert battle.drill_meters["ENEMY:0"] < 100.0 and battle.turn == 0
