"""Natural continuous simulator: seeded episodes, healthy majority, one risk."""

from __future__ import annotations

import inspect

from app.db.models import Incident
from app.simulator.config.traffic_profiles import DEMO_AGENT_IDS, resolve_systems
from app.simulator.episode_scheduler import EpisodeScheduler
from app.simulator.generators.mode_traffic import emit_bundle
from app.simulator import runner


def _plans(seed: int, n: int = 80) -> list:
    sched = EpisodeScheduler(seed, list(DEMO_AGENT_IDS), idle_ticks=16, burst=5, recovery=2, cooldown=8)
    return sched.decisions(n)


def test_same_seed_same_decisions():
    a = [(p.system_id, p.mode, p.mutation_id, p.state) for p in _plans(42)]
    b = [(p.system_id, p.mode, p.mutation_id, p.state) for p in _plans(42)]
    assert a == b
    assert a != [(p.system_id, p.mode, p.mutation_id, p.state) for p in _plans(99)]


def test_healthy_majority_and_no_overlap():
    plans = _plans(7, 90)
    episode = [p for p in plans if p.mode == "incident_window" and p.episode_id]
    healthyish = [p for p in plans if p.mode in ("baseline", "near_miss", "recovery")]
    assert len(healthyish) > len(episode)
    # One episode at a time: burst system stays constant until recovery.
    current = None
    for plan in plans:
        if plan.state == "active_burst":
            if current is None:
                current = plan.episode_id
            assert plan.episode_id == current
            assert plan.system_id
        else:
            current = None


def test_burst_is_one_agent_inside_band():
    sched = EpisodeScheduler(3, list(DEMO_AGENT_IDS), idle_ticks=4, burst=6, recovery=2, cooldown=4)
    plans = sched.decisions(30)
    bursts: list[list] = []
    bucket: list = []
    for plan in plans:
        if plan.state == "active_burst":
            bucket.append(plan)
        elif bucket:
            bursts.append(bucket)
            bucket = []
    if bucket:
        bursts.append(bucket)
    assert bursts
    for burst in bursts:
        assert 4 <= len(burst) <= 8
        assert len({p.system_id for p in burst}) == 1
        assert burst[0].mutation_id


def test_default_mix_is_five_demo_agents():
    assert resolve_systems(None, profile="demo") == list(DEMO_AGENT_IDS)
    assert len(DEMO_AGENT_IDS) == 5
    assert len(resolve_systems(None, profile="full_fleet")) == 10


def test_runner_emits_through_http_ingest():
    source = inspect.getsource(runner._continuous_loop)
    assert "post_ingest_sequence" in source


def test_near_miss_and_healthy_do_not_open_a_risk(client, db_session):
    client.post("/api/v1/simulator/reset")
    for seq in range(3):
        bundle = emit_bundle(
            "sys-agt-treasury-001",
            mode="near_miss",
            seed=5,
            seq=seq,
            simulator_run_id="near",
        )
        assert client.post("/api/v1/ingest/events", json=bundle).status_code == 200
    for seq in range(3, 6):
        bundle = emit_bundle(
            "sys-agt-treasury-001",
            mode="baseline",
            seed=5,
            seq=seq,
            simulator_run_id="healthy",
        )
        assert client.post("/api/v1/ingest/events", json=bundle).status_code == 200
    db_session.expire_all()
    rows = db_session.query(Incident).filter(Incident.system_id == "sys-agt-treasury-001").all()
    assert rows == []


def test_burst_opens_one_evolving_risk(client, db_session):
    client.post("/api/v1/simulator/reset")
    for seq in range(5):
        bundle = emit_bundle(
            "sys-agt-treasury-001",
            mode="incident_window",
            seed=8,
            seq=seq,
            simulator_run_id="burst",
            mutation_id="unsupported_claim_spike",
        )
        resp = client.post("/api/v1/ingest/events", json=bundle)
        assert resp.status_code == 200
    db_session.expire_all()
    rows = db_session.query(Incident).filter(Incident.system_id == "sys-agt-treasury-001").all()
    assert len(rows) == 1


def test_post_approval_bias_changes_the_next_trace():
    sched = EpisodeScheduler(1, ["sys-agt-treasury-001"], idle_ticks=100)
    plan = sched.next_plan(post_approval={"sys-agt-treasury-001": "improve"})
    assert plan.mode == "recovery"
    phish = EpisodeScheduler(1, ["sys-agt-phish-008"], idle_ticks=100)
    bad = phish.next_plan(post_approval={"sys-agt-phish-008": "stay_bad"})
    assert bad.mode == "incident_window"
    assert bad.mutation_id == "tool_scope_violation"


def test_recovery_trace_stays_under_claim_threshold():
    bundle = emit_bundle(
        "sys-agt-treasury-001",
        mode="recovery",
        seed=4,
        seq=1,
        simulator_run_id="recover",
    )
    rates = []
    for span in bundle.get("spans") or bundle.get("resourceSpans") or []:
        if isinstance(span, dict):
            ev = span.get("evaluation") or {}
            if "unsupported_claim_rate" in ev:
                rates.append(ev["unsupported_claim_rate"])
    # v2 bundle nests spans; walk dicts.
    def walk(node):
        if isinstance(node, dict):
            ev = node.get("evaluation")
            if isinstance(ev, dict) and "unsupported_claim_rate" in ev:
                rates.append(float(ev["unsupported_claim_rate"]))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    rates.clear()
    walk(bundle)
    assert rates
    assert max(rates) <= 0.03
