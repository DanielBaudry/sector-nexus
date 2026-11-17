from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sector_nexus.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)


# Columns added after the first release. create_all() never alters existing tables,
# so older databases get them here. (table, column, DDL type + default)
_ADDED_COLUMNS = [
    ("champions", "rank", "INTEGER DEFAULT 0"),
    ("artifacts", "rank", "INTEGER DEFAULT 5"),
    ("player_profile", "champion_xp", "INTEGER DEFAULT 0"),
]


def _ensure_columns() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in _ADDED_COLUMNS:
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _ensure_columns()


def get_session():
    with Session(engine) as session:
        yield session
