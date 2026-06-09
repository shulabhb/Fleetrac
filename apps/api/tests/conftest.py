from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient


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

    settings.database_url = database_url
    reset_engine(database_url)

    import importlib

    import main as main_module

    importlib.reload(main_module)
    return main_module.app


@pytest.fixture()
def client(app) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
async def async_client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
