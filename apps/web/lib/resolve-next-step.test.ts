import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchRequestedAction,
  resolveActionableDestination,
  resolveIncidentLifecycle,
  resolveNextStep
} from "./resolve-next-step.ts";

describe("resolveIncidentLifecycle", () => {
  it("detected risk → Review risk evidence", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-010",
      lifecycle: "Detected",
      severity: "medium"
    });
    assert.equal(life.currentStage, "DETECTED");
    assert.equal(life.primaryCtaLabel, "Review risk evidence");
    assert.equal(life.primaryDestination.surface, "risk_detail");
    assert.equal(life.canClose, false);
    assert.equal(life.closureState, "open");
  });

  it("action not approved → Approve governed action", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-011",
      actionId: "act_011",
      actionStatus: "Awaiting approval",
      verificationStatus: "Not started",
      lifecycle: "Action Approval"
    });
    assert.equal(life.currentStage, "DECISION_REQUIRED");
    assert.equal(life.currentStageLabel, "Decision required");
    assert.equal(life.nextRequiredStep, "Approve or reject governed action");
    assert.equal(life.primaryCtaLabel, "Approve governed action");
    assert.equal(life.primaryDestination.actionCenterTab, "pending");
    assert.equal(life.canClose, false);
  });

  it("approved action → Verify impact", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-012",
      actionId: "act_012",
      actionStatus: "Approved",
      verificationStatus: "Monitoring"
    });
    assert.equal(life.currentStage, "APPROVED_READY_TO_VERIFY");
    assert.equal(life.currentStageLabel, "Approved — verify impact");
    assert.equal(life.primaryCtaLabel, "Verify impact");
    assert.equal(life.primaryDestination.actionCenterTab, "ready");
    assert.equal(life.canClose, false);
  });

  it("improvement observed → Close risk / close-ready", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-015",
      actionId: "act_015",
      actionStatus: "Approved",
      verificationStatus: "Improvement Observed",
      lifecycle: "Verification"
    });
    assert.equal(life.currentStage, "VERIFICATION_IMPROVED");
    assert.equal(life.currentStageLabel, "Close-ready: improvement observed");
    assert.equal(life.primaryCtaLabel, "Close risk");
    assert.equal(life.primaryDestination.surface, "action_center");
    assert.equal(life.canClose, true);
    assert.equal(life.closureState, "close_ready");
  });

  it("rollback candidate → Review rollback path / not close-ready", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-013",
      actionId: "act_013",
      actionStatus: "Rollback candidate",
      verificationStatus: "Rollback Candidate"
    });
    assert.equal(life.currentStage, "VERIFICATION_ROLLBACK");
    assert.equal(life.primaryCtaLabel, "Review rollback path");
    assert.equal(life.canClose, false);
    assert.equal(life.closureState, "open_rollback");
  });

  it("no material change → Review follow-up / not close-ready", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-014",
      actionStatus: "Monitoring",
      verificationStatus: "No Material Change"
    });
    assert.equal(life.currentStage, "VERIFICATION_FOLLOW_UP");
    assert.equal(life.primaryCtaLabel, "Review follow-up");
    assert.equal(life.canClose, false);
    assert.equal(life.closureState, "open_follow_up");
  });

  it("resolved improvement → View outcome evidence", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-020",
      lifecycle: "Closed",
      actionStatus: "Closed",
      verificationStatus: "Improvement Observed",
      resolutionStatus: "resolved"
    });
    assert.equal(life.currentStage, "CLOSED");
    assert.equal(life.primaryCtaLabel, "View outcome evidence");
    assert.equal(life.canClose, true);
    assert.equal(life.closureState, "closed");
  });

  it("rollback decision recorded → View rollback decision", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-013",
      actionId: "act_013",
      actionStatus: "Rollback candidate",
      verificationStatus: "Rollback Candidate",
      resolutionStatus: "rollback_required"
    });
    assert.equal(life.primaryCtaLabel, "View rollback decision");
    assert.notEqual(life.primaryCtaLabel, "Review rollback path");
    assert.equal(life.canClose, false);
  });

  it("follow-up recorded → View follow-up decision", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-014",
      actionStatus: "Monitoring",
      verificationStatus: "No Material Change",
      resolutionStatus: "follow_up_assigned"
    });
    assert.equal(life.primaryCtaLabel, "View follow-up decision");
    assert.notEqual(life.nextRequiredStep, "Review follow-up");
  });

  it("Outcomes rollback CTA opens review, not risk drawer", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-sec-001",
      actionId: "act_sec",
      actionStatus: "Rollback candidate",
      verificationStatus: "Rollback Candidate",
      ctaSurface: "outcomes"
    });
    assert.equal(life.primaryCtaLabel, "Open rollback review");
    assert.equal(life.primaryDestination.surface, "action_center");
  });

  it("rejected action can close", () => {
    const life = resolveIncidentLifecycle({
      incidentId: "inc-any-021",
      actionStatus: "Rejected",
      lifecycle: "Action Approval"
    });
    assert.equal(life.currentStage, "CLOSED");
    assert.equal(life.canClose, true);
    assert.equal(life.closureState, "closed");
  });

  it("Overview/Risk Queue/Risk Detail share lifecycle labels", () => {
    const input = {
      incidentId: "inc-any-011",
      actionId: "act_011",
      actionStatus: "Awaiting approval",
      verificationStatus: "Not started",
      lifecycle: "Action Approval"
    };
    const life = resolveIncidentLifecycle(input);
    const step = resolveNextStep(input);
    assert.equal(step.title, life.nextRequiredStep);
    assert.equal(step.primaryCtaLabel, life.primaryCtaLabel);
    assert.equal(step.explanation, life.nextStepExplanation);
  });
});

describe("resolveActionableDestination", () => {
  it("selects the rollback action in Action Center, not a list", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-sec-001",
      actionId: "act_inc-sec-001_fb152eb2",
      actionStatus: "Rollback candidate",
      verificationStatus: "Rollback Candidate"
    });
    assert.equal(dest.destinationPage, "actions");
    assert.equal(dest.landingMode, "detail");
    assert.equal(dest.targetTab, "closed");
    assert.equal(dest.selectedActionId, "act_inc-sec-001_fb152eb2");
    assert.match(dest.href, /action=act_inc-sec-001_fb152eb2/);
    assert.match(dest.href, /incident=inc-sec-001/);
    assert.equal(dest.primaryCtaLabel, "Review rollback path");
  });

  it("selects the follow-up action in Action Center", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-plat-003",
      actionId: "act_plat",
      actionStatus: "Monitoring",
      verificationStatus: "No Material Change"
    });
    assert.equal(dest.landingMode, "detail");
    assert.equal(dest.targetTab, "closed");
    assert.match(dest.href, /action=act_plat/);
    assert.equal(dest.primaryCtaLabel, "Review follow-up");
  });

  it("selects the ready-to-verify action", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-any-012",
      actionId: "act_012",
      actionStatus: "Approved",
      verificationStatus: "Monitoring"
    });
    assert.equal(dest.targetTab, "ready");
    assert.equal(dest.primaryCtaLabel, "Verify impact");
    assert.match(dest.href, /tab=ready/);
    assert.match(dest.href, /action=act_012/);
  });

  it("selects the awaiting-decision action", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-any-011",
      actionId: "act_011",
      actionStatus: "Awaiting approval"
    });
    assert.equal(dest.targetTab, "pending");
    assert.equal(dest.primaryCtaLabel, "Approve governed action");
    assert.match(dest.href, /action=act_011/);
  });

  it("routes unresolved improvement to Action Center close-ready", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-mrm-001",
      actionId: "act_mrm",
      verificationStatus: "Improvement Observed"
    });
    assert.equal(dest.destinationPage, "actions");
    assert.equal(dest.primaryCtaLabel, "Close risk");
    assert.match(dest.href, /action=act_mrm/);
    assert.equal(dest.landingMode, "detail");
  });

  it("routes resolved improvement to the incident outcome record", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-mrm-001",
      actionId: "act_mrm",
      verificationStatus: "Improvement Observed",
      resolutionStatus: "resolved"
    });
    assert.equal(dest.destinationPage, "outcomes");
    assert.match(dest.href, /incidentId=inc-mrm-001/);
    assert.match(dest.href, /evidenceMode=incident-record/);
    assert.equal(dest.landingMode, "detail");
  });

  it("opens Risk Detail for a fresh risk", () => {
    const dest = resolveActionableDestination({
      incidentId: "inc-any-010",
      lifecycle: "Detected"
    });
    assert.equal(dest.destinationPage, "incidents");
    assert.equal(dest.landingMode, "drawer");
    assert.match(dest.href, /incident=inc-any-010/);
  });

  it("matches requested action by id or incident alias", () => {
    assert.equal(
      matchRequestedAction("act_011", { id: "act_011", incidentId: "inc-any-011" }),
      true
    );
    assert.equal(
      matchRequestedAction("inc-sec-001", { id: "act_x", incidentId: "inc-sec-001" }),
      true
    );
    assert.equal(
      matchRequestedAction("inc-other", { id: "act_x", incidentId: "inc-sec-001" }),
      false
    );
  });
});
