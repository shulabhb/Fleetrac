from fastapi import FastAPI

from app.api.routes import audit_logs, health, incidents, rules, systems, telemetry
from app.core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")

app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
app.include_router(telemetry.router, prefix=settings.api_prefix, tags=["telemetry"])
app.include_router(incidents.router, prefix=settings.api_prefix, tags=["incidents"])
app.include_router(rules.router, prefix=settings.api_prefix, tags=["rules"])
app.include_router(systems.router, prefix=settings.api_prefix, tags=["systems"])
app.include_router(audit_logs.router, prefix=settings.api_prefix, tags=["audit_logs"])
