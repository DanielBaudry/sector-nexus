from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.infrastructure.database.connection import get_session
from src.infrastructure.repositories.champion_repository_sql import ChampionRepositorySQL
from src.infrastructure.repositories.player_repository_sql import PlayerRepositorySQL
from src.use_cases.gacha.summon_champions import SummonChampionsUseCase
from src.presentation.schemas.dtos import SummonRequestDTO

router = APIRouter(prefix="/api/gacha", tags=["Gacha"])


@router.get("/banners")
def get_banners():
    return [
        {
            "id": "banner_standard",
            "name": "Standard Warp Beacon",
            "subtitle": "All-factions protocol summoning across the sector",
            "faction": "ALL",
            "cost_shards": 1,
            "cost_crystals": 150,
            "featured_rarity": "Legendary (3%)",
            "bg_color": "from-blue-900 to-indigo-950",
            "icon": "Radio"
        },
        {
            "id": "banner_terran",
            "name": "Terran Foundry Requisition",
            "subtitle": "Dominion mechs, ghosts, and marine commanders",
            "faction": "Terran Vanguard",
            "cost_shards": 1,
            "cost_crystals": 150,
            "featured_rarity": "Rate Up: Jim Raynor, Nova",
            "bg_color": "from-cyan-900 to-slate-950",
            "icon": "Shield"
        },
        {
            "id": "banner_zerg",
            "name": "Primal Spore Influx",
            "subtitle": "Swarm mutations and apex primal predators",
            "faction": "Bio-Swarm",
            "cost_shards": 1,
            "cost_crystals": 150,
            "featured_rarity": "Rate Up: Sarah Kerrigan, Torrasque",
            "bg_color": "from-purple-900 to-zinc-950",
            "icon": "Flame"
        },
        {
            "id": "banner_protoss",
            "name": "Khaydarin Void Rift",
            "subtitle": "Astral templars, archons, and psionic purifiers",
            "faction": "Astral Templars",
            "cost_shards": 1,
            "cost_crystals": 150,
            "featured_rarity": "Rate Up: Artanis, Tassadar",
            "bg_color": "from-amber-900 to-stone-950",
            "icon": "Sparkles"
        },
    ]


@router.post("/summon")
def summon_champions(req: SummonRequestDTO, session: Session = Depends(get_session)):
    try:
        champ_repo = ChampionRepositorySQL(session)
        player_repo = PlayerRepositorySQL(session)
        use_case = SummonChampionsUseCase(champ_repo, player_repo)
        return use_case.execute(banner_faction=req.banner_faction, count=req.count)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
