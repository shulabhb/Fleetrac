from __future__ import annotations

from pydantic import BaseModel, Field


class FleetracAnalysis(BaseModel):
    incident_id: str
    alias_id: str
    summary: str
    bounded_scope: str
    recommended_actions: list[str] = Field(default_factory=list)
    evidence_highlights: list[str] = Field(default_factory=list)
    policy_notes: str = ""
    confidence: float = 0.0
