from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest_plugins = ("pytest_asyncio",)


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "slice_a_test.db"


@pytest.fixture()
def database_url(db_path: Path) -> str:
    return f"sqlite:///{db_path}"


@pytest.fixture()
def app(database_url: str):
    os.environ["DATABASE_URL"] = database_url
    from app.core.config import settings
    from app.db.session import reset_engine
    from app.simulator.runner import stop_continuous

    settings.database_url = database_url
    settings.simulator_api_base_url = "http://test"
    settings.app_env = "test"
    reset_engine(database_url)
    stop_continuous()

    import importlib

    import main as main_module

    importlib.reload(main_module)
    from app.simulator.http_ingest_client import set_test_asgi_app

    set_test_asgi_app(main_module.app)
    stop_continuous()
    yield main_module.app
    stop_continuous()


@pytest.fixture()
def client(app) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session(client):
    from app.db.session import get_session_factory

    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()
