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
    assert data["crystals"] >= 1000

    resupply = client.post("/api/player/resupply")
    assert resupply.status_code == 200
    updated = resupply.json()
    assert updated["crystals"] > data["crystals"]


def test_champions_roster(client):
    res = client.get("/api/champions")
    assert res.status_code == 200
    champs = res.json()
    assert len(champs) >= 4
    first = champs[0]
    assert "effective_stats" in first
    assert len(first["cards"]) >= 2
    assert len(first["gambits"]) >= 1


def test_gacha_banners_and_summon(client):
    banners_res = client.get("/api/gacha/banners")
    assert banners_res.status_code == 200
    banners = banners_res.json()
    assert len(banners) == 4

    summon_res = client.post("/api/gacha/summon", json={"banner_faction": "Bio-Swarm", "count": 1})
    assert summon_res.status_code == 200
    data = summon_res.json()
    assert len(data["summoned"]) == 1
    new_champ = data["summoned"][0]
    assert new_champ["faction"] in ("Bio-Swarm", "Terran Vanguard", "Astral Templars")


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
    assert len(expedition["allies"]) == 4
    assert len(expedition["enemies"]) >= 2

    # Execute a card choice or timeout gambit
    card_id = expedition["drawn_cards"][0]["id"] if expedition.get("drawn_cards") else None
    choice_res = client.post("/api/expeditions/choice", json={"card_id": card_id})
    assert choice_res.status_code == 200
    updated_exp = choice_res.json()
    assert len(updated_exp["combat_log"]) > len(expedition["combat_log"])


def test_background_expedition_flow(client):
    dispatch_res = client.post("/api/expeditions/background/dispatch", json={
        "biome_id": "biome_aiur",
        "squad_id": "squad_alpha",
        "duration_seconds": 0  # 0 seconds to immediately test claim!
    })
    assert dispatch_res.status_code == 200
    bg = dispatch_res.json()
    assert bg["id"].startswith("bg_")

    claim_res = client.post(f"/api/expeditions/background/{bg['id']}/claim")
    assert claim_res.status_code == 200
    claim_data = claim_res.json()
    assert "claimed_rewards" in claim_data
    assert claim_data["claimed_rewards"]["credits"] > 0
