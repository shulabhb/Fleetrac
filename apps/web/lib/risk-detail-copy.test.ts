import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evidenceSupportSentence,
  formatMetricBreach,
  impactExplanation,
  riskDetailCta,
  verificationPendingCopy
} from "./risk-detail-copy.ts";

describe("Risk Detail copy", () => {
  it("renders a human-readable breach snapshot", () => {
    const text = formatMetricBreach({
      metricName: "unsupported_claim_rate",
      controlName: "Unsupported claim rate elevated",
      latestObservedValue: 0.041,
      thresholdValue: 0.03,
      thresholdOperator: ">"
    });
    assert.equal(
      text,
      "Unsupported claim rate exceeded threshold: 0.041 observed vs 0.030 allowed."
    );
  });

  it("explains missing evidence without looking like a crash", () => {
    assert.match(evidenceSupportSentence(0), /No packaged evidence yet/);
    assert.match(evidenceSupportSentence(3), /3 related events/);
  });

  it("changes the CTA with action state", () => {
    assert.equal(riskDetailCta("Awaiting approval", "Not started"), "Review governed action");
    assert.equal(riskDetailCta("Approved", "Monitoring"), "Verify impact");
    assert.equal(
      riskDetailCta("Closed", "Improvement Observed"),
      "View outcome evidence"
    );
    assert.equal(
      riskDetailCta("Rollback candidate", "Rollback Candidate"),
      "Review rollback path"
    );
    assert.equal(riskDetailCta("Monitoring", "No Material Change"), "Review follow-up");
  });

  it("states verification outcome versus a pending window", () => {
    assert.match(verificationPendingCopy(true, true), /pending after action approval/);
    assert.match(verificationPendingCopy(true, false), /until the governed action is approved/);
    assert.match(impactExplanation("Cyber"), /Security impact/);
    assert.match(impactExplanation("Output Reliability"), /Governance impact/);
    assert.match(impactExplanation("Technology"), /Reliability impact/);
  });
});
