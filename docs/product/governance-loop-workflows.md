# Governance loop workflows

What a Fleet Governor can do in Fleetrac, and what each step writes. Approval records a decision. It does not apply, deploy, or change agent code. Source control is not connected.

## Loop

```
Runtime telemetry
  → POST /api/v1/ingest/events
  → normalize → detect → one incident per correlation cluster
  → evidence package + governed action (Awaiting approval)
  → human decision (Approve or Reject)
  → if approved: verify an outcome
  → Evidence Library and Action Center show the same record
```

A generated event and a flagship pitch use this same path. The simulator does not write incidents directly.

## Where each step lives

| Step | Surface | What the governor does |
|------|---------|------------------------|
| See the risk | Overview, Risk Queue, Action Center, Evidence Library | Open the same risk drawer |
| Read evidence | Drawer Evidence tab, Evidence Library | Open the packaged record |
| Decide | Drawer Decision tab, Evidence Library, Action Center “Awaiting decision” | Approve or reject |
| Hand off | Drawer, Evidence Library, Risk Queue | Open the existing governed action. Creates one only if detection did not |
| Verify | Drawer Verification tab, Action Center “Ready to verify” | Record one outcome |
| Look back | Drawer History, Evidence Library, Action Center “Verification results” | Read lifecycle and the recorded outcome |

## Decision states

| Action status | Incident lifecycle | Next step |
|---------------|--------------------|-----------|
| Awaiting approval | Owner Review or Action Approval | Approve or reject |
| Approved | Remediation | Verify impact |
| Rejected | Closed | Evidence stays. No verification |
| Monitoring | Verification | A non-closing outcome was recorded |
| Closed | Closed | Improvement observed |
| Rollback candidate | Verification | Review the rollback path. Nothing is rolled back |

Sending a risk to Action Center after it is already approved, verified, or rejected does not move the lifecycle backward.

## Verification outcomes

Recorded only after approval. Each outcome is stored on the action and as an evidence item.

| Outcome | Action status after | Incident lifecycle | Meaning |
|---------|---------------------|--------------------|---------|
| Improvement observed | Closed | Closed | The watched metric moved in the expected direction |
| No material change | Monitoring | Verification | Not enough movement to close the risk |
| Regression detected | Rollback candidate | Verification | The signal worsened |
| Rollback candidate | Rollback candidate | Verification | Review a rollback path. Code is not rolled back |

Applied externally stays unavailable. Fleetrac does not deploy the change.

## What stays out of the loop

- Requesting evidence from an external system. New evidence arrives from telemetry.
- Changing the reviewer. The name on the record is the one already stored.
- Connecting a source repository. A name saved in Settings stays in the browser.
- Marking a false positive as a separate archive. Reject is the recorded decision, and the evidence record remains.
