import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codeInvestigationFromSignals,
  governancePhases,
  uncertaintyFromConfidence
} from "./risk-triage.ts";

describe("governance phases", () => {
  it("keeps a proposal distinct from approval and apply", () => {
    const phases = governancePhases("Awaiting approval", "Not started");
    assert.equal(phases.find((p) => p.id === "proposed")?.state, "current");
    assert.equal(phases.find((p) => p.id === "approved")?.state, "upcoming");
    assert.equal(phases.find((p) => p.id === "applied_externally")?.state, "unavailable");
    assert.equal(phases.find((p) => p.id === "verified")?.state, "upcoming");
  });

  it("does not treat approval as execution or verification", () => {
    const phases = governancePhases("Approved", "Monitoring");
    assert.equal(phases.find((p) => p.id === "approved")?.state, "current");
    assert.equal(phases.find((p) => p.id === "applied_externally")?.state, "unavailable");
    assert.match(
      phases.find((p) => p.id === "approved")?.detail ?? "",
      /does not apply/
    );
    assert.equal(phases.find((p) => p.id === "verified")?.state, "upcoming");
  });

  it("marks verification without inventing an external apply", () => {
    const phases = governancePhases("Closed", "Improvement Observed");
    assert.equal(phases.find((p) => p.id === "verified")?.state, "current");
    assert.equal(phases.find((p) => p.id === "applied_externally")?.state, "unavailable");
    assert.match(
      phases.find((p) => p.id === "applied_externally")?.detail ?? "",
      /did not execute or deploy/
    );
  });
});

describe("code investigation", () => {
  it("does not invent a cause when no citation exists", () => {
    const result = codeInvestigationFromSignals([
      { span_name: "agent.request", tool_name: "search" }
    ]);
    assert.equal(result.outcome, "insufficient_evidence");
    assert.equal(result.citations.length, 0);
    assert.equal(result.cause, null);
  });

  it("reports a candidate cause only with a real citation", () => {
    const result = codeInvestigationFromSignals([
      {
        file: "apps/agent/tools.py",
        line: 42,
        commit: "abc123",
        candidate_cause: "Tool allow-list omitted the quarantine scope."
      }
    ]);
    assert.equal(result.outcome, "candidate_cause");
    assert.equal(result.citations[0]?.file, "apps/agent/tools.py");
    assert.equal(result.citations[0]?.line, "42");
    assert.equal(result.cause, "Tool allow-list omitted the quarantine scope.");
  });

  it("honors an explicit no-cause outcome", () => {
    const result = codeInvestigationFromSignals([
      {
        file: "apps/agent/tools.py",
        commit: "abc123",
        investigation_outcome: "no_cause_found"
      }
    ]);
    assert.equal(result.outcome, "no_cause_found");
    assert.equal(result.cause, null);
  });
});

describe("uncertainty", () => {
  it("says confidence was not recorded instead of guessing", () => {
    const reading = uncertaintyFromConfidence(null);
    assert.equal(reading.confidence, "Not assessed");
    assert.match(reading.uncertainty, /not recorded/);
  });

  it("explains low confidence as limited evidence, not a product failure", () => {
    const reading = uncertaintyFromConfidence("Low");
    assert.equal(reading.confidence, "Low");
    assert.match(reading.uncertainty, /Limited packaged evidence/);
    assert.match(reading.uncertainty, /not a product failure/);
  });
});
