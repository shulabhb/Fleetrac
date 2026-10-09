import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActionVerificationUx } from "./action-verification-ux.ts";

function ux(status: string, verification: string) {
  return resolveActionVerificationUx({
    status,
    rawVerificationStatus: verification,
    verificationStatus: verification
  });
}

describe("Action Center lanes and CTAs", () => {
  it("groups states into the three lanes", () => {
    assert.equal(ux("Awaiting approval", "Not started").lane, "awaiting_decision");
    assert.equal(ux("Approved", "Monitoring").lane, "ready_to_verify");
    assert.equal(ux("Closed", "Improvement Observed").lane, "verification_result");
    assert.equal(ux("Rollback candidate", "Rollback Candidate").lane, "verification_result");
    assert.equal(ux("Monitoring", "No Material Change").lane, "verification_result");
  });

  it("uses state-specific CTAs and outcome labels", () => {
    assert.equal(ux("Awaiting approval", "Not started").nextStepCta, "Review decision");
    assert.equal(ux("Approved", "Monitoring").nextStepCta, "Verify impact");
    assert.equal(ux("Approved", "Monitoring").verificationLabel, "Verification pending");
    assert.equal(ux("Closed", "Improvement Observed").verificationLabel, "Improvement observed");
    assert.equal(ux("Closed", "Improvement Observed").nextStepCta, "View outcome evidence");
    assert.equal(ux("Rollback candidate", "Rollback Candidate").nextStepCta, "Review rollback path");
    assert.equal(ux("Monitoring", "No Material Change").verificationLabel, "No material change");
    assert.equal(ux("Monitoring", "Follow-up Required").verificationLabel, "Follow-up required");
  });
});
