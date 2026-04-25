from fastapi import FastAPI

try:
    # Works when launched from `apps/api` via `uvicorn main:app`.
    from app.api.routes import (
        actions,
        audit_logs,
        bob,
        health,
        incidents,
        operations,
        rules,
        systems,
        telemetry,
    )
    from app.core.config import settings
except ModuleNotFoundError:
    # Works when launched from repo root via `uvicorn apps.api.main:app`.
    from apps.api.app.api.routes import (
        actions,
        audit_logs,
        bob,
        health,
        incidents,
        operations,
        rules,
        systems,
        telemetry,
    )
    from apps.api.app.core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")

app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
app.include_router(telemetry.router, prefix=settings.api_prefix, tags=["telemetry"])
app.include_router(incidents.router, prefix=settings.api_prefix, tags=["incidents"])
app.include_router(rules.router, prefix=settings.api_prefix, tags=["rules"])
app.include_router(systems.router, prefix=settings.api_prefix, tags=["systems"])
app.include_router(audit_logs.router, prefix=settings.api_prefix, tags=["audit_logs"])
app.include_router(bob.router, prefix=settings.api_prefix, tags=["bob"])
app.include_router(actions.router, prefix=settings.api_prefix, tags=["actions"])
app.include_router(operations.router, prefix=settings.api_prefix, tags=["operations"])
