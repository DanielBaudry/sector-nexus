import random

import pytest
from fastapi.testclient import TestClient

from src.domain.entities.artifact import Artifact
from src.domain.entities.champion import Champion, xp_for_level
from src.domain.entities.expedition_run import ExpeditionRun
from src.domain.services.expedition_run_service import ExpeditionRunService
from src.domain.services.loot_service import LootService
from src.domain.value_objects import artifact_stats as AS
from src.domain.value_objects.enums import (
    ArtifactSetType, ArtifactSlot, Faction, NodeType, Rarity, Role, RunStatus,
)
from src.domain.value_objects.stats import Stats
from src.infrastructure.database.seed_data import get_seed_biomes
from src.main import app


class AlwaysSucceed(random.Random):
    def random(self):
        return 0.0


class AlwaysFail(random.Random):
    def random(self):
        return 0.999


def champ(rarity=Rarity.COMMON, **kw):
    return Champion(
        id=kw.pop("id", "c1"), template_id="t", name="Test", title="", faction=Faction.TERRAN, role=Role.ASSAULT,
        rarity=rarity, level=kw.pop("level", 1), experience=0,
        base_stats=Stats(hp=100, max_hp=100, shields=0, max_shields=0, attack=50, defense=10, speed=100,
                         crit_rate=0.1, crit_damage=1.5),
        cards=[], gambits=[], **kw,
    )


# ── Artifacts ────────────────────────────────────────────────────────────────
def test_artifact_starting_substats_follow_rarity_and_skip_main_stat():
    rng = random.Random(1)
    for rarity, n in AS.STARTING_SUBSTATS.items():
        art = Artifact.generate("a", rarity, 5, ArtifactSetType.OFFENSE, rng=rng, slot=ArtifactSlot.WEAPON)
        assert art.level == 0 and len(art.sub_stats) == n
        assert all(s["stat"] != art.main_stat_name for s in art.sub_stats)
        assert len({s["stat"] for s in art.sub_stats}) == n


def test_artifact_upgrade_to_16_adds_then_boosts_substats():
    art = Artifact.generate("a", Rarity.EPIC, 6, ArtifactSetType.CRIT, rng=random.Random(2), slot=ArtifactSlot.WEAPON)
    base_main = art.main_stat_value
    rng = AlwaysSucceed(3)
    results = [art.try_upgrade(rng) for _ in range(16)]
    assert art.level == 16 and art.is_maxed
    assert art.main_stat_value == AS.main_value("attack", 6, 16) > base_main
    milestone = [r for r in results if "substat" in r]
    assert len(milestone) == 4                     # +4, +8, +12, +16
    # Epic starts with 2 substats: +4 and +8 add the 3rd and 4th, +12 and +16 boost.
    assert [m["substat"]["kind"] for m in milestone] == ["added", "added", "boosted", "boosted"]
    assert len(art.sub_stats) == 4
    with pytest.raises(ValueError):
        art.try_upgrade(rng)


def test_artifact_upgrade_failure_keeps_level():
    art = Artifact.generate("a", Rarity.RARE, 4, ArtifactSetType.SPEED, rng=random.Random(4))
    art.level = 10
    before = art.main_stat_value
    assert art.try_upgrade(AlwaysFail(5)) == {"success": False, "level": 10}
    assert art.main_stat_value == before
    assert AS.upgrade_chance(10) < AS.upgrade_chance(1)
    assert AS.upgrade_cost(6, 10) > AS.upgrade_cost(3, 10) > AS.upgrade_cost(3, 0)


def test_percent_and_flat_gear_stats_apply():
    c = champ(equipped_artifact_ids={"Weapon": "w", "Neural Implant": "i"})
    weapon = Artifact("w", "t", "W", ArtifactSlot.WEAPON, Rarity.RARE, ArtifactSetType.SPEED, 0, "attack", 10,
                      [{"stat": "attack_pct", "value": 0.10}])
    implant = Artifact("i", "t", "I", ArtifactSlot.IMPLANT, Rarity.RARE, ArtifactSetType.SHIELD, 0, "crit_rate", 0.2,
                       [{"stat": "hp_pct", "value": 0.5}])
    stats = c.get_effective_stats({"w": weapon, "i": implant})
    assert stats.attack == int(50 * 1.10 + 10)
    assert stats.max_hp == int(100 * 1.5)
    assert stats.crit_rate == pytest.approx(0.3)


# ── Champions ────────────────────────────────────────────────────────────────
def test_starting_rank_from_rarity_and_level_cap():
    assert champ(Rarity.COMMON).rank == 1 and champ(Rarity.LEGENDARY).rank == 4
    c = champ(Rarity.COMMON)
    assert c.max_level == 10
    used = c.gain_xp(10 ** 7)
    assert c.level == 10 and c.is_level_maxed
    assert used == sum(xp_for_level(l) for l in range(1, 10))


def test_rank_up_requires_max_level_and_resets_level():
    c = champ(Rarity.COMMON)
    with pytest.raises(ValueError, match="level 10"):
        c.rank_up()
    c.gain_xp(10 ** 7)
    c.rank_up()
    assert c.rank == 2 and c.level == 1 and c.max_level == 20


def test_rank_and_level_raise_stats():
    low = champ(Rarity.COMMON).get_effective_stats({})
    high = champ(Rarity.COMMON, rank=3, level=20).get_effective_stats({})
    assert high.attack > low.attack and high.max_hp > low.max_hp


# ── Loot & payout ────────────────────────────────────────────────────────────
def test_loot_rank_scales_with_biome_and_boss():
    biomes = {b.id: b for b in get_seed_biomes()}
    assert LootService.biome_rank(biomes["biome_mar_sara"]) < LootService.biome_rank(biomes["biome_void"])
    loot = LootService(random.Random(6))
    boss = loot.roll_artifacts(biomes["biome_char"], NodeType.BOSS, 6)
    assert 2 <= len(boss) <= 3
    assert all(a.rank == LootService.biome_rank(biomes["biome_char"]) + 1 or a.rank >= 4 for a in boss)
    assert loot.roll_champion_xp(biomes["biome_void"], NodeType.BOSS, 6) > loot.roll_champion_xp(biomes["biome_mar_sara"], NodeType.COMBAT, 1)


def test_extraction_keeps_half_rounded_up():
    service = ExpeditionRunService(rng=random.Random(7))
    arts = [{"id": f"a{i}"} for i in range(5)]
    run = ExpeditionRun(id="r", biome_id="b", biome_name="B", squad_id="s", status=RunStatus.ABANDONED,
                        rewards={"credits": 1001, "crystals": 10, "champion_xp": 300, "artifacts": arts})
    payout = service.finalize_payout(run)
    assert payout["credits"] == 500 and payout["champion_xp"] == 150
    assert len(payout["artifacts"]) == 3 and payout["artifacts_lost"] == 2
    assert service.finalize_payout(run) is payout  # stable once computed

    win = ExpeditionRun(id="r2", biome_id="b", biome_name="B", squad_id="s", status=RunStatus.VICTORY,
                        rewards={"credits": 10, "crystals": 0, "champion_xp": 5, "artifacts": arts})
    assert len(service.finalize_payout(win)["artifacts"]) == 5


# ── API ──────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_progression_api(client):
    client.post("/api/player/resupply")
    champs = client.get("/api/champions").json()
    target = champs[0]
    assert {"rank", "max_level", "xp_to_next", "can_rank_up"} <= set(target)

    arts = client.get("/api/artifacts").json()
    art = next(a for a in arts if a["level"] < 16)
    assert {"rank", "upgrade_cost", "upgrade_chance"} <= set(art)
    res = client.post(f"/api/artifacts/{art['id']}/upgrade")
    assert res.status_code == 200, res.text
    body = res.json()
    assert "success" in body["result"] and body["result"]["cost"] == art["upgrade_cost"]

    no_xp = client.post(f"/api/champions/{target['id']}/feed-xp", json={"amount": 10 ** 9})
    assert no_xp.status_code in (200, 400)

    bad = client.post(f"/api/champions/{target['id']}/rank-up", json={"fodder_ids": []})
    assert bad.status_code == 400
