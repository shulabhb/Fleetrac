"""Slice A constants — re-export treasury system from fleet registry for backward compatibility."""

from app.fleet.registry import (
    RULE_BY_ID,
    SYSTEM_BY_ID,
    canonical_incident_id,
    incident_alias,
)

_treasury = SYSTEM_BY_ID["sys-agt-treasury-001"]
_rule = RULE_BY_ID["rule_unsupported_claim_high"]

SYSTEM_ID = _treasury.id
SYSTEM_DISPLAY_ID = _treasury.display_id
SYSTEM_NAME = _treasury.name
SYSTEM_NAME_ALIAS = _treasury.name_alias

OWNER_TEAM = _treasury.owner_team
TEAM_LEAD = _treasury.team_lead
DEFAULT_REVIEWER = _treasury.default_reviewer

RULE_ID = _rule.id
SIGNAL_TYPE = _rule.signal_type
THRESHOLD_FIELD = _rule.threshold_field
THRESHOLD_VALUE = _rule.threshold_value

CLASSIFICATION_CATEGORY = _rule.risk_category
CLASSIFICATION_SEVERITY = _rule.severity
CLASSIFICATION_PRIORITY = _rule.priority
LIFECYCLE_FINAL = _rule.lifecycle_final

INCIDENT_CANONICAL_ID = canonical_incident_id(SYSTEM_ID, SIGNAL_TYPE)
INCIDENT_ALIAS_ID = incident_alias(SYSTEM_ID, SIGNAL_TYPE)

CORRELATION_WINDOW_MINUTES = 30
