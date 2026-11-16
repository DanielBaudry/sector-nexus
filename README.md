# SECTOR NEXUS // StarCraft Tactical Gacha RPG

> A tactical, sci-fi Gacha RPG inspired by the depth of *Raid: Shadow Legends* set in a gritty *StarCraft*-inspired universe. Built with **FastAPI Clean Architecture** on the backend and a high-tech **React + Tailwind CSS HUD** on the frontend.

---

## 🌟 Key Features

### 1. 🌌 Warp Beacon Invocations (Gacha)
- **4 Dedicated Banners**: Universal Standard Beacon, Terran Foundry Requisition, Primal Spore Influx, and Khaydarin Void Rift.
- **Roster Across 3 Factions**:
  - **Terran Vanguard**: Jim Raynor (Rebel Marshal), Nova Terra (Covert Ghost), Lieutenant Lisa (Field Surgeon), General Duke (Siege Operator).
  - **Bio-Swarm (Zerg)**: Sarah Kerrigan (Queen of Blades), Torrasque (Apex Behemoth), Dehaka (Primal Packleader), Voracious Hunter (Spine Impaler).
  - **Astral Templars (Protoss)**: Hierarch Artanis (Firstborn Champion), Executor Tassadar (Twilight Archon), Prelate Zeratul (Dark Templar), Phase-Smith Karax (Pylon Architect).
- **Rarity Tiers**: Legendary (3%), Epic (15%), Rare (42%), Common (40%).
- Full reveal modal with glowing card animations, quotes, and stats.

### 2. 🛡️ Armory, 6-Slot Artifacts & Set Bonuses
- **Modular Gear Slots**: Weapon, Armor, Helmet, Boots, Neural Implant, Power Core.
- **Set Bonuses**:
  - *Hyper-Thrusters* (2-piece): +12% Speed
  - *Gauss Overcharge* (2-piece): +15% Attack
  - *Psionic Aegis* (2-piece): +20% Shields
  - *Precision Matrix* (2-piece): +15% Crit Rate
  - *Bio-Leech* (4-piece): Life-steal on hull damage
- In-game gear enhancement (+1 to +16) with credit costs and stat scaling.

### 3. 🧠 Automated AI Gambit System
- Configure priority rule-based gambits for every champion:
  - *“If Ally HP < 50% -> Nanite Injection / Shield Barrier”*
  - *“If Self Shields Depleted -> Fortify / Shield Overcharge”*
  - *“If Enemy is Elite or Boss -> C-20A Snipe / Crushing Grip”*
  - *“If Hostiles > 1 -> Hyperion Orbital Salvo / Psionic Storm”*
  - *“Default -> Always Basic Attack / Penetrator Round”*
- Automatically triggers during background idle expeditions AND during active combat if the player's decision timer expires!

### 4. ⚔️ Fast-Paced Card Combat with 7-Second Countdown Timer
- Deploy squads to diverse biomes:
  - **Char: Molten Ashfields** (Thermal Overheat hazard)
  - **Aiur: Khaydarin Ruins** (Psionic Resonance hazard)
  - **Mar Sara: Badland Outposts** (Scrap Ambush hazard)
  - **Derelict Station: Void Sector** (Null-Atmosphere hazard)
- Active Time Battle (ATB) Initiative meter driven by operative Speed.
- **7.0-Second Decision Gauge**: Smooth countdown bar shifting from Cyan to Warning Amber to Pulsing Danger Red.
- Play tactical cards (keyboard shortcuts `[1]`, `[2]`, `[3]` or click).
- Real-time combat telemetry log showing critical hits, shield shatter, and bio-healing.

### 5. 🛰️ Orbital Background Farming (Idle Expeditions)
- Dispatch squads to orbit for passive harvesting.
- Progress tracked in real-time.
- Rewards include Warp Crystals, Credits, Champion Experience, and rare Artifact gear drops.

---

## 🏗️ Backend Clean Architecture Layout

```
backend/
├── src/
│   ├── domain/                         # Pure business logic (No DB/Framework dependencies)
│   │   ├── entities/                   # Champion, Artifact, Squad, Expedition, Biome, Player
│   │   ├── value_objects/              # Stats, Faction, Rarity, Role, ArtifactSet, CombatCard, GambitRule
│   │   ├── repositories/               # Repository interfaces (IChampionRepo, IArtifactRepo, etc.)
│   │   └── services/                   # CombatEngine, GambitEvaluator, GachaService, IdleService
│   ├── use_cases/                      # Application workflows
│   │   ├── gacha/                      # SummonChampionsUseCase
│   │   ├── champions/                  # GetChampions, UpdateGambits, EquipArtifact, UpgradeArtifact
│   │   ├── squads/                     # GetSquads, UpdateSquad
│   │   ├── expeditions/                # StartActiveExpedition, ExecuteTimedCardChoice, TickExpedition
│   │   └── background/                 # DispatchBackgroundExpedition, ClaimBackgroundRewards
│   ├── infrastructure/                 # DB, Models, Repositories, External services
│   │   ├── database/                   # SQLite connection & SQLModel table definitions
│   │   │   ├── models/                 # ChampionSQL, ArtifactSQL, SquadSQL, PlayerProfileSQL, etc.
│   │   │   └── seed_data.py            # Initial StarCraft heroes catalog, biomes, and starter gear
│   │   └── repositories/               # SQLChampionRepository, SQLArtifactRepository, etc.
│   ├── presentation/                   # API Routers & Schemas
│   │   ├── controllers/                # /api/player, /api/gacha, /api/champions, /api/expeditions...
│   │   └── schemas/                    # Pydantic request/response DTOs
│   └── main.py                         # FastAPI App, Lifespan startup, and CORS
└── tests/                              # Unit & integration test suite (100% passing)
```

---

## 🚀 Running the Project

### One-Click Launch (Both Backend & Frontend)
Run the automated launcher script from the root of `sector-nexus`:

```bash
./start.sh
```

- **Web Browser HUD**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Manual Launch

#### 1. Backend (FastAPI)
```bash
cd backend
.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend (Vite + React)
```bash
cd frontend
npm run dev -- --port 3000
```

### Running Backend Tests
```bash
cd backend
.venv/bin/python3 -m pytest tests
```
