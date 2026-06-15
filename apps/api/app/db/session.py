from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.models import Base, NormalizedEvent

_engine = None
_SessionLocal = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        connect_args = {}
        if settings.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(settings.database_url, connect_args=connect_args)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def init_db() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema(engine)
    _migrate_sqlite_normalized_events_nullable_severity(engine)


def _sqlite_default_literal(value) -> str:
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(value, list):
        return "'[]'"
    if isinstance(value, dict):
        return "'{}'"
    return "''"


def _sqlite_column_ddl(column, dialect) -> str:
    type_sql = str(column.type.compile(dialect=dialect))
    if type_sql.upper() == "JSON":
        type_sql = "TEXT"

    default_val = None
    if column.default is not None and hasattr(column.default, "arg"):
        arg = column.default.arg
        if not callable(arg):
            default_val = arg

    if column.nullable:
        if default_val is not None:
            return f"{type_sql} DEFAULT {_sqlite_default_literal(default_val)}"
        return type_sql

    if default_val is not None:
        return f"{type_sql} NOT NULL DEFAULT {_sqlite_default_literal(default_val)}"
    if isinstance(column.type.python_type, bool):  # type: ignore[union-attr]
        return f"{type_sql} NOT NULL DEFAULT 0"
    if column.type.python_type in (int, float):  # type: ignore[union-attr]
        return f"{type_sql} NOT NULL DEFAULT 0"
    return f"{type_sql} NOT NULL DEFAULT ''"


def _migrate_sqlite_schema(engine) -> None:
    """Add missing columns on existing SQLite DBs (create_all does not alter tables)."""
    if engine.dialect.name != "sqlite":
        return

    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if not inspector.has_table(table_name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                ddl = _sqlite_column_ddl(column, engine.dialect)
                conn.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {ddl}")
                )


def _migrate_sqlite_normalized_events_nullable_severity(engine) -> None:
    """Rebuild normalized_events when legacy DBs have severity NOT NULL (healthy spans need NULL)."""
    if engine.dialect.name != "sqlite":
        return

    from sqlalchemy import text

    with engine.begin() as conn:
        table_names = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
        }

        if "normalized_events_legacy" in table_names:
            if "normalized_events" in table_names:
                current_count = conn.execute(
                    text("SELECT COUNT(*) FROM normalized_events")
                ).scalar_one()
                if current_count == 0:
                    for row in conn.execute(text("PRAGMA index_list(normalized_events)")).fetchall():
                        if not row[2]:
                            conn.execute(text(f"DROP INDEX IF EXISTS {row[1]}"))
                    conn.execute(text("DROP TABLE normalized_events"))
            if "normalized_events" not in {
                row[0]
                for row in conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                ).fetchall()
            }:
                conn.execute(
                    text("ALTER TABLE normalized_events_legacy RENAME TO normalized_events")
                )

        table_names = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
        }
        if "normalized_events" not in table_names:
            NormalizedEvent.__table__.create(bind=conn)
            return

        severity_row = next(
            (
                row
                for row in conn.execute(text("PRAGMA table_info(normalized_events)")).fetchall()
                if row[1] == "severity"
            ),
            None,
        )
        if severity_row is None or severity_row[3] == 0:
            conn.execute(text("DROP TABLE IF EXISTS normalized_events_legacy"))
            return

        for row in conn.execute(text("PRAGMA index_list(normalized_events)")).fetchall():
            if not row[2]:
                conn.execute(text(f"DROP INDEX IF EXISTS {row[1]}"))

        conn.execute(text("ALTER TABLE normalized_events RENAME TO normalized_events_legacy"))
        NormalizedEvent.__table__.create(bind=conn)

        legacy_cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(normalized_events_legacy)")).fetchall()
        }
        target_cols = [column.name for column in NormalizedEvent.__table__.columns]
        shared_cols = [name for name in target_cols if name in legacy_cols]
        if not shared_cols:
            raise RuntimeError("normalized_events migration failed: no shared columns")

        col_sql = ", ".join(shared_cols)
        conn.execute(
            text(
                f"INSERT INTO normalized_events ({col_sql}) "
                f"SELECT {col_sql} FROM normalized_events_legacy"
            )
        )
        conn.execute(text("DROP TABLE normalized_events_legacy"))


def reset_engine(database_url: str | None = None) -> None:
    """Test helper: point at a new database URL."""
    global _engine, _SessionLocal
    if database_url is not None:
        settings.database_url = database_url
    _engine = None
    _SessionLocal = None


def get_db() -> Generator[Session, None, None]:
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    factory = get_session_factory()
    db = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
