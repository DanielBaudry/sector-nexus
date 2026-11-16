from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from contextlib import asynccontextmanager

from src.infrastructure.database.connection import create_db_and_tables, engine
from src.infrastructure.database.models.sql_models import ChampionSQL, ArtifactSQL, SquadSQL
from src.infrastructure.database.seed_data import (
    get_seed_champion_templates,
    get_seed_starting_artifacts,
)
from src.presentation.controllers import (
    gacha_controller,
    champions_controller,
    artifacts_controller,
    squads_controller,
    expeditions_controller,
    player_controller,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    create_db_and_tables()

    # Seed initial champions and starter artifacts if empty
    with Session(engine) as session:
        existing_champs = session.exec(select(ChampionSQL)).all()
        if not existing_champs:
            templates = get_seed_champion_templates()
            # Give player 4 starting champions: Raynor, Nova, Lisa (Medic), Duke (Tank)
            starter_templates = [t for t in templates if t.faction.name == "TERRAN"]
            starter_champ_ids = []
            for t in starter_templates:
                data = t.to_dict()
                row = ChampionSQL(**data)
                session.add(row)
                starter_champ_ids.append(t.id)

            session.commit()

            # Seed starting artifacts
            for art in get_seed_starting_artifacts():
                session.add(ArtifactSQL(**art.to_dict()))
            session.commit()

            # Seed default squad
            default_squad = SquadSQL(
                id="squad_alpha",
                name="Dominion 1st Strike Team",
                champion_ids=starter_champ_ids[:4],
            )
            session.add(default_squad)
            session.commit()

    yield


app = FastAPI(
    title="Sector Nexus API - StarCraft Tactical Gacha RPG",
    description="Clean Architecture backend for StarCraft-inspired Gacha with timed tactical card combat & idle expeditions.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(player_controller.router)
app.include_router(gacha_controller.router)
app.include_router(champions_controller.router)
app.include_router(artifacts_controller.router)
app.include_router(squads_controller.router)
app.include_router(expeditions_controller.router)


@app.get("/")
def root():
    return {
        "system": "Sector Nexus Command Core",
        "status": "ONLINE",
        "version": "1.0.0",
        "endpoints": [
            "/api/player",
            "/api/gacha/banners",
            "/api/champions",
            "/api/artifacts",
            "/api/squads",
            "/api/expeditions/biomes",
            "/api/expeditions/active",
            "/api/expeditions/background",
        ],
    }
