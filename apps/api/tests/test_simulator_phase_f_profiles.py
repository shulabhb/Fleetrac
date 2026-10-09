"""Phase F — demo traffic profiles, scenario windows, soft degradation."""

from __future__ import annotations

from app.simulator.config.scenario_stories import SCENARIO_STORIES, resolve_story
from app.simulator.config.traffic_profiles import (
    DEMO_AGENT_IDS,
    DEFAULT_RATE_EPS,
    RATE_PROFILES,
    resolve_systems,
    weighted_pick,
)
from app.simulator.generators.mode_traffic import emit_bundle
from app.simulator.engine import make_run_context, run_agent
from app.simulator import scenario_windows as windows


def test_demo_agent_ids_are_five():
    assert len(DEMO_AGENT_IDS) == 5
    assert "sys-agt-treasury-001" in DEMO_AGENT_IDS
    assert "sys-agt-phish-008" in DEMO_AGENT_IDS
    assert "sys-agt-cs-002" in DEMO_AGENT_IDS


def test_default_rate_is_safe_local():
    assert DEFAULT_RATE_EPS <= 1.0
    assert RATE_PROFILES["baseline"].rate_eps == DEFAULT_RATE_EPS
    assert RATE_PROFILES["stress"].max_events is not None


def test_resolve_systems_demo_vs_full():
    demo = resolve_systems(None, profile="demo")
    assert demo == list(DEMO_AGENT_IDS)
    full = resolve_systems(None, profile="full_fleet")
    assert len(full) >= 5


def test_weighted_pick_deterministic():
    ids = list(DEMO_AGENT_IDS)
    a = weighted_pick(ids, 0)
    b = weighted_pick(ids, 0)
    assert a == b
    assert a in ids


def test_scenario_stories_map_to_pitch_aliases():
    treasury = resolve_story("treasury_grounding_or_model_risk_issue")
    assert treasury is not None
    assert treasury.pitch_alias == "inc-mrm-001"
    assert treasury.expected_verification == "improvement_observed"

    phish = resolve_story("phishing_security_anomaly")
    assert phish is not None
    assert phish.pitch_alias == "inc-sec-001"
    assert phish.expected_verification == "rollback_candidate"

    plat = resolve_story("platform_or_tool_degradation")
    assert plat is not None
    assert plat.pitch_alias == "inc-plat-003"
    assert plat.expected_verification == "no_material_change"

    # Existing pitch ids still resolve
    assert "treasury_unsupported_claim" in SCENARIO_STORIES


def test_soft_degradation_stays_under_thresholds():
    ctx = make_run_context(seed=7, scenario_id="soft_degradation", system_id="sys-agt-treasury-001")
    trace = run_agent("sys-agt-treasury-001", "soft_degradation", ctx)
    claim = next((s for s in trace.spans if s.name == "evaluate.unsupported_claims"), None)
    if claim and "unsupported_claim_rate" in claim.evaluation:
        assert claim.evaluation["unsupported_claim_rate"] < 0.03


def test_mode_traffic_baseline_and_incident():
    healthy = emit_bundle("sys-agt-treasury-001", mode="baseline", seed=1, seq=0)
    assert healthy["schema_version"] == "2.0"
    breach = emit_bundle(
        "sys-agt-treasury-001",
        mode="incident_window",
        seed=1,
        seq=1,
        mutation_id="unsupported_claim_spike",
    )
    assert breach["schema_version"] == "2.0"


def test_scenario_window_lifecycle():
    windows.clear_window()
    w = windows.start_window(
        "treasury_grounding_or_model_risk_issue",
        phases=["degradation", "incident_window"],
        events_per_phase=2,
    )
    assert w.current_phase == "degradation"
    plan = windows.peek_emit_plan()
    assert plan is not None
    assert plan[0] == "sys-agt-treasury-001"
    assert plan[1] == "degradation"
    windows.commit_emit()
    windows.commit_emit()
    assert windows.peek_emit_plan()[1] == "incident_window"
    windows.commit_emit()
    windows.commit_emit()
    status = windows.window_status()
    assert status["done"] is True
    windows.clear_window()


def test_scenario_window_api(client):
    client.post("/api/v1/simulator/reset")
    stories = client.get("/api/v1/simulator/stories")
    assert stories.status_code == 200
    assert len(stories.json()["stories"]) >= 3

    resp = client.post(
        "/api/v1/simulator/scenario-window",
        json={
            "story_id": "phishing_security_anomaly",
            "phases": ["incident_window"],
            "events_per_phase": 1,
            "ensure_running": True,
            "rate_profile": "quiet",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["story"]["pitch_alias"] == "inc-sec-001"
    assert body["window"]["active"] is True
    client.post("/api/v1/simulator/stop")
    client.delete("/api/v1/simulator/scenario-window")


def test_start_defaults_to_safe_demo_rate(client):
    client.post("/api/v1/simulator/reset")
    start = client.post(
        "/api/v1/simulator/start",
        json={"mode": "continuous", "rate_profile": "baseline", "profile": "demo", "seed": 9},
    )
    assert start.status_code == 200
    data = start.json()
    assert data["rate_eps"] <= 1.0
    assert set(data["systems"]) == set(DEMO_AGENT_IDS)
    status = client.get("/api/v1/simulator/status").json()
    assert status["running"] is True
    client.post("/api/v1/simulator/stop")
