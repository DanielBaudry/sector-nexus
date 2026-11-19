import pytest

from src.domain.entities.battle import LaneUnit
from src.domain.entities.player import PlayerProfile
from src.domain.entities.troop_forces import TroopForces
from src.domain.services.barracks_service import BarracksService
from src.domain.value_objects.enums import Side
from src.domain.value_objects.troop import TroopTemplate
from src.domain.value_objects.upgrade import Upgrade

T = "Terran Vanguard"
BARRACKS = Upgrade("barracks", "Barracks", T, cost_credits=1000)
TECH_LAB = Upgrade("tech_lab", "Tech Lab", T, cost_credits=2000, cost_crystals=20, requires=("barracks",))
WEAPONS = Upgrade("weapons", "Weapons", T, kind="research", cost_credits=500, requires=("barracks",), bonus={"attack": 0.5})
ARMOR = Upgrade("armor", "Armor", T, kind="research", cost_credits=500, requires=("barracks",), bonus={"hp": 0.5})
ZERG_UP = Upgrade("zerg_up", "Zerg", "Bio-Swarm", kind="research", bonus={"attack": 1.0})
MARINE = TroopTemplate("marine", "Marines", T, count=4, unit_hp=10, unit_attack=4, defense=10, cost_credits=300,
                       requires=("barracks",))
NAMES = {"barracks": "Barracks", "tech_lab": "Tech Lab"}


def player(credits=5000, crystals=100):
    return PlayerProfile(id="p", username="c", crystals=crystals, credits=credits)


def test_research_needs_requirements_and_funds():
    svc, forces, me = BarracksService(), TroopForces(), player()
    with pytest.raises(ValueError, match="requires Barracks"):
        svc.research(me, forces, TECH_LAB, NAMES)
    svc.research(me, forces, BARRACKS, NAMES)
    assert "barracks" in forces.researched and me.credits == 4000
    with pytest.raises(ValueError, match="already"):
        svc.research(me, forces, BARRACKS, NAMES)
    poor = player(credits=5000, crystals=0)
    with pytest.raises(ValueError, match="Not enough"):
        svc.research(poor, TroopForces(researched={"barracks"}), TECH_LAB, NAMES)


def test_train_requires_structure_and_pays_per_pack():
    svc, forces, me = BarracksService(), TroopForces(), player()
    with pytest.raises(ValueError, match="requires Barracks"):
        svc.train(me, forces, MARINE, 1, NAMES)
    forces.researched.add("barracks")
    svc.train(me, forces, MARINE, 3, NAMES)
    assert forces.available("marine") == 3 and me.credits == 5000 - 900
    with pytest.raises(ValueError, match="Not enough"):
        svc.train(player(credits=100), forces, MARINE, 1, NAMES)


def test_take_and_give_back_packs():
    forces = TroopForces(stock={"marine": 2})
    with pytest.raises(ValueError, match="Only 2"):
        BarracksService.take(forces, ["marine"] * 3, {"marine": "Marines"})
    BarracksService.take(forces, ["marine", "marine"], {})
    assert forces.available("marine") == 0
    alive = LaneUnit.troop_from_template("a", MARINE, Side.ALLY)
    dead = LaneUnit.troop_from_template("b", MARINE, Side.ALLY)
    dead.is_alive = False
    assert BarracksService.give_back(forces, [alive, dead]) == 1
    assert forces.available("marine") == 1


def test_research_bonus_applies_to_faction_packs_only():
    forces = TroopForces(researched={"barracks", "weapons", "armor", "zerg_up"})
    bonus = BarracksService.faction_bonus(T, forces, [BARRACKS, WEAPONS, ARMOR, ZERG_UP])
    assert bonus["attack"] == 0.5 and bonus["hp"] == 0.5
    pack = LaneUnit.troop_from_template("a", MARINE, Side.ALLY)
    BarracksService.apply_bonus(pack, bonus)
    assert pack.unit_attack == 6 and pack.unit_hp == 15
    assert pack.max_hp == pack.hp == 60 and pack.count == 4
    assert BarracksService.boosted_stats(MARINE, bonus)["volley"] == 24


def test_barracks_api_research_and_train(client):
    client.post("/api/player/resupply")
    view = client.get("/api/barracks").json()
    assert {f["name"] for f in view["factions"]} == {"Terran Vanguard", "Bio-Swarm", "Astral Templars"}
    pool = next(u for u in view["upgrades"] if u["id"] == "zerg_spawning_pool")
    if pool["status"] != "done":
        res = client.post("/api/barracks/research", json={"upgrade_id": "zerg_spawning_pool"})
        assert res.status_code == 200, res.text
        assert next(u for u in res.json()["upgrades"] if u["id"] == "zerg_spawning_pool")["status"] == "done"
    owned = next(t for t in client.get("/api/barracks").json()["troops"] if t["id"] == "troop_zergling")["owned"]
    res = client.post("/api/barracks/train", json={"template_id": "troop_zergling", "quantity": 2})
    assert res.status_code == 200, res.text
    assert next(t for t in res.json()["troops"] if t["id"] == "troop_zergling")["owned"] == owned + 2
    den = next(u for u in res.json()["upgrades"] if u["id"] == "zerg_hydralisk_den")
    hydra = next(t for t in res.json()["troops"] if t["id"] == "troop_hydralisk")
    if den["status"] != "done":
        assert not hydra["unlocked"]
        assert client.post("/api/barracks/train", json={"template_id": "troop_hydralisk", "quantity": 1}).status_code == 400


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from src.main import app
    with TestClient(app) as c:
        yield c
