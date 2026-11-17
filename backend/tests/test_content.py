import json
import shutil

import pytest

from src.infrastructure.content import library as content
from src.infrastructure.content.library import ContentError, ContentLibrary, content_dir, get_library


def test_shipped_content_is_valid():
    lib = ContentLibrary.load(content_dir())
    assert len(lib.heroes) >= 12 and len(lib.planets) == 4 and len(lib.bosses) == 6
    assert list(lib.planets)[0] == "biome_char"                      # explicit order
    raynor = lib.champion_template("tmpl_terran_raynor")
    ids = [c.id for c in raynor.cards]
    assert "raynor_drop_pods" in ids                                   # summons live in the hero file
    assert next(c for c in raynor.cards if c.id == "raynor_hyperion_barrage").lane_scope.value == "all_lanes"
    assert lib.hero_passive("tmpl_protoss_zeratul").kind.value == "ON_KILL_METER"


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    root = tmp_path / "content"
    shutil.copytree(content_dir(), root)
    monkeypatch.setenv("CONTENT_DIR", str(root))
    monkeypatch.setattr(content, "_cache", (None, None))
    return root


def _edit(path, fn):
    data = json.loads(path.read_text())
    fn(data)
    path.write_text(json.dumps(data))


def test_edits_hot_reload(sandbox):
    assert get_library().champion_template("tmpl_terran_raynor").base_stats.attack == 52
    _edit(sandbox / "heroes" / "terran_raynor.json", lambda d: d["stats"].update(attack=99))
    assert get_library().champion_template("tmpl_terran_raynor").base_stats.attack == 99


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d["abilities"][0].update(target_type="everyone"), "abilities.0.target_type"),
    (lambda d: d.update(atack=5), "atack"),
    (lambda d: d["gambits"][0].update(card_id="nope"), "unknown ability 'nope'"),
    (lambda d: d["abilities"][0].update(summon_troop_id="troop_dragon"), "unknown troop 'troop_dragon'"),
])
def test_invalid_hero_names_file_and_problem(sandbox, mutate, message):
    _edit(sandbox / "heroes" / "terran_raynor.json", mutate)
    with pytest.raises(ContentError) as e:
        ContentLibrary.load(sandbox)
    assert "terran_raynor" in str(e.value) and message in str(e.value)


def test_boss_reference_checks(sandbox):
    _edit(sandbox / "bosses" / "skarn.json", lambda d: d.update(superior="boss_nobody"))
    with pytest.raises(ContentError, match="unknown superior"):
        ContentLibrary.load(sandbox)


def test_owned_champions_pick_up_content_changes(sandbox):
    from fastapi.testclient import TestClient
    from src.main import app

    _edit(sandbox / "heroes" / "terran_raynor.json", lambda d: d["abilities"][0].update(name="Redesigned Round"))
    with TestClient(app) as c:
        champs = c.get("/api/champions").json()
    raynor = next((ch for ch in champs if ch["template_id"] == "tmpl_terran_raynor"), None)
    if raynor is None:
        pytest.skip("test database has no Raynor")
    assert raynor["cards"][0]["name"] == "Redesigned Round"
