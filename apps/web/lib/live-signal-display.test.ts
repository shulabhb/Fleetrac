import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  keyMetricLine,
  linkageCopy,
  matchesSignalFilters,
  monitorSignalState
} from "./live-signal-display.ts";

describe("Runtime Monitor display", () => {
  it("renders a healthy event as below threshold", () => {
    const state = monitorSignalState({
      operationType: "model_call",
      signalState: "healthy",
      severity: "Healthy"
    });
    assert.equal(state, "Healthy");
    assert.equal(linkageCopy(state, null), "Below threshold — no risk created");
  });

  it("renders a degrading signal without a risk", () => {
    const state = monitorSignalState({
      operationType: "output_evaluation",
      signalState: "warning",
      severity: "Medium"
    });
    assert.equal(state, "Signal degrading");
    assert.equal(linkageCopy(state, null), "Below threshold — no risk created");
  });

  it("renders a breached event with a linked risk", () => {
    const state = monitorSignalState({
      operationType: "output_evaluation",
      normalizedSignalType: "unsupported_claim_elevated",
      signalState: "governance",
      severity: "Critical",
      incidentId: "inc-mrm-001"
    });
    assert.equal(state, "Control breached");
    assert.equal(linkageCopy(state, "inc-mrm-001"), "Linked risk: inc-mrm-001");
    assert.equal(
      keyMetricLine({ unsupported_claim_rate: 0.041 }),
      "unsupported claim rate 0.041"
    );
  });

  it("labels regression and filters by state", () => {
    const state = monitorSignalState({
      normalizedSignalType: "latency_regression",
      incidentId: "inc-plat-003",
      severity: "Medium"
    });
    assert.equal(state, "Regression");
    assert.equal(
      matchesSignalFilters(
        { systemId: "sys-agt-cs-002", eventType: "model_call", state },
        { systemId: "sys-agt-treasury-001", state: "Regression" }
      ),
      false
    );
    assert.equal(
      matchesSignalFilters(
        { systemId: "sys-agt-cs-002", eventType: "model_call", state },
        { systemId: "all", eventType: "model_call", state: "Regression" }
      ),
      true
    );
  });
});
