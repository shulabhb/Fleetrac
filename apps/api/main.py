from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.api.routes import (
        actions,
        audit_logs,
        bob,
        events_stream,
        governance,
        health,
        incidents,
        ingestion,
        operations,
        rules,
        simulator,
        systems,
        telemetry,
    )
    from app.core.config import settings
    from app.db.seed import seed_config
    from app.db.session import get_session_factory, init_db
except ModuleNotFoundError:
    from apps.api.app.api.routes import (
        actions,
        audit_logs,
        bob,
        events_stream,
        governance,
        health,
        incidents,
        ingestion,
        operations,
        rules,
        simulator,
        systems,
        telemetry,
    )
    from apps.api.app.core.config import settings
    from apps.api.app.db.seed import seed_config
    from apps.api.app.db.session import get_session_factory, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    factory = get_session_factory()
    db = factory()
    try:
        seed_config(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
app.include_router(telemetry.router, prefix=settings.api_prefix, tags=["telemetry"])
app.include_router(incidents.router, prefix=settings.api_prefix, tags=["incidents"])
app.include_router(rules.router, prefix=settings.api_prefix, tags=["rules"])
app.include_router(systems.router, prefix=settings.api_prefix, tags=["systems"])
app.include_router(audit_logs.router, prefix=settings.api_prefix, tags=["audit_logs"])
app.include_router(bob.router, prefix=settings.api_prefix, tags=["bob"])
app.include_router(actions.router, prefix=settings.api_prefix, tags=["actions"])
app.include_router(operations.router, prefix=settings.api_prefix, tags=["operations"])
app.include_router(ingestion.router, prefix=settings.api_prefix, tags=["ingestion"])
app.include_router(governance.router, prefix=settings.api_prefix, tags=["governance"])
app.include_router(simulator.router, prefix=settings.api_prefix, tags=["simulator"])
app.include_router(events_stream.router, prefix=settings.api_prefix, tags=["events"])
