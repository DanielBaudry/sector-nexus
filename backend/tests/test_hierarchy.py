from src.domain.entities.hierarchy_standing import ChampionStatus, HierarchyStanding
from src.domain.services.hierarchy_service import ADAPTATIONS, HierarchyService
from src.domain.value_objects.enums import NodeType, RunStatus
from src.infrastructure.database.seed_data import get_seed_boss_encounters

BOSSES = get_seed_boss_encounters()
BY_ID = {b.id: b for b in BOSSES}


def fresh():
    return {b.id: HierarchyStanding(b.id, "biome_char") for b in BOSSES}


def status(bid, standings):
    return HierarchyService.status(BY_ID[bid], standings[bid], BOSSES, standings)


def test_pyramid_gating():
    s = fresh()
    assert status("boss_skarn", s) == ChampionStatus.HUNTED
    assert status("boss_vexthara", s) == ChampionStatus.LOCKED
    assert status("boss_zargul", s) == ChampionStatus.LOCKED
    s["boss_skarn"].defeated = True
    assert status("boss_vexthara", s) == ChampionStatus.HUNTED      # one captain is enough
    assert status("boss_morghast", s) == ChampionStatus.LOCKED
    s["boss_vexthara"].defeated = True
    assert status("boss_zargul", s) == ChampionStatus.LOCKED        # overlord needs both lieutenants
    s["boss_morghast"].defeated = True
    assert status("boss_zargul", s) == ChampionStatus.HUNTED


def test_targeting_is_exclusive_and_rejects_locked():
    s = fresh()
    HierarchyService.set_target(BY_ID["boss_skarn"], BOSSES, s)
    HierarchyService.set_target(BY_ID["boss_ixil"], BOSSES, s)
    assert [b for b, st in s.items() if st.targeted] == ["boss_ixil"]
    try:
        HierarchyService.set_target(BY_ID["boss_zargul"], BOSSES, s)
        assert False, "locked champion should not be targetable"
    except ValueError:
        pass


def test_influence_banking_shares_and_cap():
    boss = BY_ID["boss_skarn"]
    st = HierarchyStanding(boss.id, "biome_char")
    assert HierarchyService.bank_run_influence(st, boss, 40, RunStatus.ABANDONED) == 20
    assert HierarchyService.bank_run_influence(st, boss, 40, RunStatus.DEFEAT) == 10
    assert HierarchyService.bank_run_influence(st, boss, 500, RunStatus.VICTORY) == boss.influence_required - 30
    assert st.influence == boss.influence_required
    assert HierarchyService.node_influence(NodeType.ELITE, 5) > HierarchyService.node_influence(NodeType.ELITE, 1)


def test_loss_keeps_progress_and_adapts():
    boss = BY_ID["boss_skarn"]
    st = HierarchyStanding(boss.id, "biome_char", influence=60)
    for _ in range(5):
        HierarchyService.record_fight(st, won=False)
    assert st.losses == len(ADAPTATIONS) and st.influence == 60 and not st.defeated
    adapted = HierarchyService.adapted(boss, st.losses)
    assert adapted.hp > boss.hp and adapted.attack > boss.attack and adapted.defense > boss.defense
    assert adapted.phases[0].get("summons")                    # reinforcements from turn one
    assert not boss.phases[0].get("summons")                   # seed data untouched
    HierarchyService.record_fight(st, won=True)
    assert st.defeated and not st.targeted
