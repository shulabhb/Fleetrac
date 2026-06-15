"""Ingest validation — envelope, OTEL structural, semantic warnings."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

TRACE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
SPAN_ID_RE = re.compile(r"^[0-9a-f]{16}$")

SPAN_KINDS = frozenset({"INTERNAL", "CLIENT", "SERVER", "PRODUCER", "CONSUMER"})
STATUS_CODES = frozenset({"OK", "ERROR", "UNSET"})


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _validate_trace_id(trace_id: str, *, label: str, errors: list[str]) -> None:
    if not TRACE_ID_RE.match(trace_id):
        errors.append(f"{label}: invalid trace_id format")


def _validate_span_id(span_id: str, *, label: str, errors: list[str]) -> None:
    if not SPAN_ID_RE.match(span_id):
        errors.append(f"{label}: invalid span_id format")


def validate_envelope(payload: dict[str, Any]) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    for key in ("schema_version", "source_type", "system_id", "tenant_id", "environment", "idempotency_key"):
        if not payload.get(key):
            errors.append(f"missing required field: {key}")

    if payload.get("schema_version") == "2.0":
        structural = validate_v2_bundle(payload)
        errors.extend(structural.errors)
        warnings.extend(structural.warnings)
    elif payload.get("source_type") in ("otel_agent_trace", "langgraph_trace", "custom_agent_trace"):
        tid, sid = payload.get("trace_id"), payload.get("span_id")
        if tid:
            _validate_trace_id(str(tid), label="flat", errors=errors)
        if sid:
            _validate_span_id(str(sid), label="flat", errors=errors)

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)


def validate_v2_bundle(payload: dict[str, Any]) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    trace_id = str(payload.get("trace_id", ""))
    _validate_trace_id(trace_id, label="bundle", errors=errors)

    spans = payload.get("spans")
    if not isinstance(spans, list) or not spans:
        errors.append("v2 bundle requires non-empty spans[]")
        return ValidationResult(ok=False, errors=errors, warnings=warnings)

    span_ids = set()
    for idx, span in enumerate(spans):
        if not isinstance(span, dict):
            errors.append(f"span[{idx}] must be object")
            continue
        sid = str(span.get("span_id", ""))
        _validate_span_id(sid, label=f"span[{idx}]", errors=errors)
        if sid in span_ids:
            errors.append(f"duplicate span_id: {sid}")
        span_ids.add(sid)

        kind = span.get("kind", "INTERNAL")
        if kind not in SPAN_KINDS:
            errors.append(f"span[{idx}]: unknown kind {kind}")

        status = span.get("status") or {}
        code = status.get("code", "OK") if isinstance(status, dict) else "OK"
        if code not in STATUS_CODES:
            errors.append(f"span[{idx}]: unknown status code {code}")

        start = span.get("start_time_unix_nano")
        end = span.get("end_time_unix_nano")
        if start is not None and end is not None and int(end) < int(start):
            errors.append(f"span[{idx}]: end_time before start_time")

        parent = span.get("parent_span_id")
        if parent:
            _validate_span_id(str(parent), label=f"span[{idx}].parent", errors=errors)
            if str(parent) not in span_ids and idx > 0:
                warnings.append(f"span[{idx}]: parent_span_id not in prior spans (may be root)")

    if not payload.get("resource"):
        warnings.append("missing resource block")
    if not payload.get("instrumentation_scope"):
        warnings.append("missing instrumentation_scope block")

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)
