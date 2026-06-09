from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class System(Base):
    __tablename__ = "systems"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    display_id: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    name_alias: Mapped[str | None] = mapped_column(String(256), nullable=True)
    owner_team: Mapped[str] = mapped_column(String(128), nullable=False)
    team_lead: Mapped[str] = mapped_column(String(128), nullable=False)
    default_reviewer: Mapped[str] = mapped_column(String(128), nullable=False)
    baseline_metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    applicable_control_ids: Mapped[list[str]] = mapped_column(JSON, default=list)


class DetectionRule(Base):
    __tablename__ = "detection_rules"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    signal_type: Mapped[str] = mapped_column(String(128), nullable=False)
    threshold_field: Mapped[str] = mapped_column(String(128), nullable=False)
    threshold_operator: Mapped[str] = mapped_column(String(16), default=">")
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True)


class RawEvent(Base):
    __tablename__ = "raw_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    system_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NormalizedEvent(Base):
    __tablename__ = "normalized_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    source_provider: Mapped[str] = mapped_column(String(64), nullable=False)
    source_service: Mapped[str] = mapped_column(String(128), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    system_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    trace_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    span_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    operation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tool: Mapped[str | None] = mapped_column(String(256), nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    evaluation_signals: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    policy_result: Mapped[str | None] = mapped_column(String(32), nullable=True)
    normalized_signal_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    evidence_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    raw_payload_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_team: Mapped[str | None] = mapped_column(String(128), nullable=True)
    applicable_control_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    correlation_key: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    incident_id: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    content_mode: Mapped[str] = mapped_column(String(32), default="metadata_only")
    payload_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(256), primary_key=True)
    alias_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    system_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    correlation_key: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    rule_id: Mapped[str] = mapped_column(String(128), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(128), nullable=False)
    classification_category: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    lifecycle: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_team: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    lifecycle_history: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), default="Packaged")
    packaged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    evidence_record_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FleetracAnalysisRow(Base):
    __tablename__ = "fleetrac_analysis"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    template: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    recipient: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="sent")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    reviewer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(64), default="reviewer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SimulatorState(Base):
    __tablename__ = "simulator_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    running: Mapped[bool] = mapped_column(default=False)
    mode: Mapped[str] = mapped_column(String(32), default="idle")
    rate_eps: Mapped[float] = mapped_column(Float, default=5.0)
    last_scenario: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_count: Mapped[int] = mapped_column(default=0)
    incident_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    pitch_step: Mapped[int] = mapped_column(default=0)
    active_systems: Mapped[list[str]] = mapped_column(JSON, default=list)


class GovernedActionRow(Base):
    __tablename__ = "governed_actions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    alias_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    owner_team: Mapped[str] = mapped_column(String(128), nullable=False)
    system_id: Mapped[str] = mapped_column(String(128), nullable=False)
    system_name: Mapped[str] = mapped_column(String(256), nullable=False)
    risk_category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    execution_mode: Mapped[str] = mapped_column(String(32), default="approval_required")
    status: Mapped[str] = mapped_column(String(64), default="Awaiting approval")
    verification_status: Mapped[str] = mapped_column(String(64), default="Not started")
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VerificationOutcomeRow(Base):
    __tablename__ = "verification_outcomes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    incident_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
