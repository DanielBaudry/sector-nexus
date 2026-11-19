import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_player_profile_and_resupply(client):
    res = client.get("/api/player")
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "Dominion Commander"
    assert data["crystals"] >= 0 and data["credits"] >= 0

    resupply = client.post("/api/player/resupply")
    assert resupply.status_code == 200
    updated = resupply.json()
    assert updated["crystals"] > data["crystals"]


def test_champions_roster(client):
    res = client.get("/api/champions")
    assert res.status_code == 200
    champs = res.json()
    assert len(champs) >= 1
    first = champs[0]
    assert "effective_stats" in first
    assert len(first["cards"]) >= 2
    assert len(first["gambits"]) >= 1


def test_warp_beacon_lists_every_hero_and_blocks_unready_prints(client):
    res = client.get("/api/warp-beacon")
    assert res.status_code == 200
    data = res.json()
    assert data["print_cost"] == 100 and data["total"] == len(data["heroes"]) > 0
    assert "warp_shards" not in client.get("/api/player").json()
    locked = next((h for h in data["heroes"] if not h["ready"]), None)
    if locked:
        bad = client.post("/api/warp-beacon/warpcopy", json={"template_id": locked["template_id"]})
        assert bad.status_code == 400


def test_expeditions_flow(client):
    # Get biomes
    biomes_res = client.get("/api/expeditions/biomes")
    assert biomes_res.status_code == 200
    biomes = biomes_res.json()
    assert len(biomes) == 4

    # Start live expedition
    start_res = client.post("/api/expeditions/start", json={"biome_id": "biome_char", "squad_id": "squad_alpha"})
    assert start_res.status_code == 200
    expedition = start_res.json()
    assert expedition["status"] == "IN_PROGRESS"
    assert 1 <= len(expedition["allies"]) <= 4
    assert len(expedition["enemies"]) >= 2

    # Execute a card choice or timeout gambit
    card_id = expedition["drawn_cards"][0]["id"] if expedition.get("drawn_cards") else None
    choice_res = client.post("/api/expeditions/choice", json={"card_id": card_id})
    assert choice_res.status_code == 200
    updated_exp = choice_res.json()
    assert len(updated_exp["combat_log"]) > len(expedition["combat_log"])
