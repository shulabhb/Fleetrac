import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countDemoRisks,
  filterModels,
  overviewNextStep,
  pickHighestPriorityModel,
  verificationResultCount
} from "./overview-summary.ts";

const demo = (id: string) => id.startsWith("sys-agt-");

describe("Overview summary", () => {
  it("counts demo risks and ignores closed or out-of-scope rows", () => {
    const counts = countDemoRisks(
      [
        { systemId: "sys-agt-treasury-001", severity: "critical", lifecycle: "Closed" },
        { systemId: "sys-agt-phish-008", severity: "critical", lifecycle: "Owner Review" },
        { systemId: "sys-agt-cs-002", severity: "medium", lifecycle: "Verification" },
        { systemId: "sys-other", severity: "critical", lifecycle: "Owner Review" }
      ],
      demo
    );
    assert.deepEqual(counts, { active: 2, criticalHigh: 1 });
  });

  it("defaults to the highest-priority model", () => {
    const picked = pickHighestPriorityModel([
      { id: "M40", openIncidents: 0, status: "Low", ownerTeam: "Model Risk Management" },
      { id: "PHISH", openIncidents: 1, status: "Critical", ownerTeam: "Security Operations" },
      { id: "A12", openIncidents: 2, status: "Medium", ownerTeam: "Platform Reliability" }
    ]);
    assert.equal(picked?.id, "PHISH");
  });

  it("combines owner, category, and severity filters", () => {
    const models = [
      { id: "a", openIncidents: 1, status: "Critical" as const, ownerTeam: "Security Operations", primaryRisk: "Cyber Risk" },
      { id: "b", openIncidents: 1, status: "High" as const, ownerTeam: "Security Operations", primaryRisk: "Technology Risk" },
      { id: "c", openIncidents: 1, status: "Critical" as const, ownerTeam: "Model Risk Management", primaryRisk: "Output Reliability" }
    ];
    const filtered = filterModels(models, {
      ownerTeam: "Security Operations",
      severity: "Critical"
    });
    assert.deepEqual(filtered.map((model) => model.id), ["a"]);
  });

  it("names the next step from the action, not a generic queue", () => {
    assert.equal(
      overviewNextStep({
        lifecycle: "Action Approval",
        actionStatus: "Rollback candidate",
        verificationStatus: "Rollback Candidate",
        incidentId: "inc-sec-001"
      }).label,
      "Review rollback path"
    );
    assert.equal(
      overviewNextStep({
        lifecycle: "Verification",
        actionStatus: "Monitoring",
        verificationStatus: "No Material Change"
      }).label,
      "Review follow-up"
    );
    assert.equal(
      overviewNextStep({
        actionStatus: "Awaiting approval",
        lifecycle: "Action Approval"
      }).label,
      "Review governed action"
    );
    assert.equal(
      overviewNextStep({ actionStatus: "Approved", verificationStatus: "Monitoring" }).label,
      "Verify impact"
    );
    assert.equal(
      overviewNextStep({ verificationStatus: "Improvement Observed" }).label,
      "View outcome evidence"
    );
    assert.equal(overviewNextStep({ openIncidents: 0 }).label, "Monitoring");
    assert.equal(
      overviewNextStep({ openIncidents: 1, incidentId: "inc-sec-001" }).label,
      "Review risk inc-sec-001"
    );
  });

  it("sums verification results from backend counters", () => {
    assert.equal(verificationResultCount({ improved: 1, followUp: 1, rollback: 1 }), 3);
  });
});
