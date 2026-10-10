# Completion Report — Action workflow closure polish

Verification results now have a real operator resolution step. Action Center shows Rollback review / Follow-up review / Close-ready panels with recorded choices. Decisions persist on the existing governed action (`resolution_status`, `resolution_note`, recorded at/by) via `POST /governance/actions/{id}/resolve`. Fleetrac records the decision only — it does not execute rollback or change agent code. Next-step copy updates after recording, so Risk Detail / Action Center / Outcomes no longer loop on “Review rollback path”. Closed/resolved risks leave the active queue; Outcomes still shows evidence.

Pytest: 5 resolve/verify tests passed. Helper tests: 43 passed. `npm run build` passed. Frontend at http://127.0.0.1:3000 (HTTP 200). API restarted on :8000.

---

# Completion Report — Actionable next-step routing

Next-step CTAs now deep-link to the selected action or incident (`?action=` + `?incident=`). Action Center waits to resolve the requested action, shows its detail panel (not only the list), and does not auto-select the first card while resolving. Missing targets show “Action not found” with a Risk Queue link. Outcomes still open the incident record. No backend change.

Helper tests: 39 passed. `npm run build` passed. Frontend restarted at http://127.0.0.1:3000.

---

# Completion Report — Incident lifecycle workflow

Shared `resolveIncidentLifecycle` maps existing incident/action/verification fields to stages (Detected → Evidence review → Decision required → Approved — verify impact → Improved / Rollback / Follow-up → Closed). Improved is close-ready; rollback and no-material-change stay open. Overview, Risk Queue, Risk Detail, Action Center, and Outcomes use the same labels and destinations. No backend, nav, or model change.

Helper tests: 32 passed. `npm run build` passed. Frontend restarted at http://127.0.0.1:3000.

---

# Completion Report — Dynamic next-step resolver

Shared `resolveNextStep` drives next-required-step copy and destinations across Overview, Risk Detail, Risk Queue, Action Center, and Outcomes. Destinations follow workflow state (evidence review, awaiting decision, ready to verify, rollback, follow-up, improvement, critical), not a hardcoded alias. Overview row titles still open Risk Detail; CTAs follow the resolver. No backend, nav, or layout redesign.

Helper tests: 30 passed. `npm run build` passed. Frontend restarted at http://127.0.0.1:3000.

---

# Completion Report — Overview CTAs stay in sidecar

Overview “Risks requiring action” and recent activity open the Risk Detail drawer on the matching tab (Decision, Verification, or Evidence). They no longer navigate to Action Center or Outcomes Audit. Action Center and Evidence Library remain secondary links inside the drawer.

---

# Completion Report — Risk click routing polish

Overview CTAs no longer always open Risk Detail. Fresh / owner / evidence review still does. Awaiting decision and ready-to-verify go to Action Center with the action selected. Rollback and follow-up go to Action Center Verification results. Improvement observed goes to Outcomes Audit for that incident. Risk Detail Code is disabled without source access. Applied-externally and Low-confidence copy stay honest. Aliases unchanged. No backend change.

Helper tests: 17 passed. `npm run build` passed.

---

# Completion Report — Overview CTA destinations

Risks requiring action now open the incident on the matching loop tab: Review rollback path / Review follow-up / Verify impact → Verification; Review governed action → Decision; View outcome evidence → Evidence. Summary (Fleetrac Analysis) is no longer the default. Owner teams “Awaiting” is “Needs attention.” Header button is “Review risk queue” and lands on the full `/incidents` list.

Helper tests: `lib/overview-summary.test.ts` — 5 passed.

---

# Completion Report — Action Center → full Risk Queue

Action Center “Review risk queue” now opens `/incidents` (all teams). Incident deep links from Act (`routeToIncident`) select that risk on the full queue instead of `queue=owner` for one team. Dashboard team clicks still use the owner-scoped queue.

Frontend restarted at http://127.0.0.1:3000.

---

# Completion Report — Risk triage drawer

Risk rows on Overview and the Risk Queue open a right-side drawer with Summary, Evidence, Code Investigation, Actions, and History. The header shows severity, owner, uncertainty, and the next step. Code investigation stays read-only and reports insufficient evidence unless a file citation is already on the record. Proposed, Approved, Applied externally, and Verified stay separate. Approval does not apply or deploy a change. The Evidence Library package link uses the existing incident record route.

Triage helper tests passed (11 with the existing risk-detail copy tests). `npm run build` passed. Checked on Overview and the Risk Queue with `inc-sec-001`.

---

# Completion Report — Overview color polish

Risk Ownership Insights, the Owner Action Panel, and the agents table stay on white. Severity is a small badge or a thin left border. Selected owner and agent rows use a soft indigo wash and a thin indigo accent, including when the risk is critical. The primary action button stays dark.

`npm run build` passed. Overview is up at http://127.0.0.1:3000.

---

# Completion Report — Overview polish

The Owner Action Panel is now three blocks: what broke, the current step, and one next action. The button follows the governed action (review the action, verify impact, review rollback, review follow-up, or view outcome evidence) and offers Open risk detail beside it. The agents section is one card: owner summary, filter chips, and a table labeled Agent, Posture, Last evidence, and Next step. The standalone “Showing systems owned by…” bar is gone. KPIs, operational metrics, nav, and data fetching are unchanged.

Overview helper tests passed (5). `npm run build` passed.

---

# Completion Report — In-app notifications

The bell now shows one in-app row per risk. That row is rewritten when the next step changes: decision, verify impact, rollback, follow-up, improvement, severity raised to critical, or regression. Slack and email copies are not created and are hidden if they already exist. Overview counts and the Owner Action Panel are unchanged.

On the current workspace the bell should list three rows: `inc-mrm-001` improved, `inc-sec-001` rollback candidate, `inc-plat-003` no material change. Each link stays visible and opens the matching view.

Tests: `pytest tests/test_in_app_notifications.py` — 6 passed.

---

# Completion Report — Final demo polish

User-facing names now match the walkthrough: Fleetrac, Governance Insights on Overview, Agent Fleet, Runtime Monitor, Risk Queue, Action Center, and Outcomes Audit. The sidebar reset control says “Reset workspace” instead of “Reset demo state.” Settings no longer uses the word prototype in the subtitle. Agent and notification links say Open risk queue or Inspect runtime signals.

Checklist: `docs/demo/final-demo-checklist.md`. Screenshot order is in that file.

Ran reset, then Treasury, Phishing, and Platform pitches. All three aliases returned. Eight seconds of baseline added no new aliases. Approve and verify then recorded improvement observed, rollback candidate, and no material change. Those verifies had no later telemetry sample, so the summaries say “Story fallback.” Health check passed. Backend tests: 12 passed. `npm run build` passed.

Known limits: legacy controls and Bob internals are still in the repo but not in primary nav. A verify immediately after a pitch uses the story fallback until a recovery or regression window is run.

---

# Completion Report — Overview polish

Overview KPIs now use the demo-agent risk queues: 5 governed agents, active risks, critical/high, actions awaiting decision, and verification results. The selected agent defaults to the highest open severity. On the current data that is Phishing Triage, with a next step to review `inc-sec-001`. Empty filters say no agents match. Counts are not taken from a static catalog when the API queues are loaded.

Overview helper tests passed. `npm run build` passed.

---

# Completion Report — Runtime Monitor polish

Event rows now show time, agent, event type, a health label, a key metric when present, and a trace id. Breached rows say “Linked risk: inc-mrm-001” and offer Review risk. Healthy rows say “Below threshold — no risk created.” Filters cover agent, event type, signal state, and severity. An empty feed says to start the simulator. Breached rows stay above healthy traffic.

Checked on `/live-signals` after a Treasury incident window: output evaluation showed unsupported claim rate 0.041, Control breached, linked to inc-mrm-001. Display tests passed. `npm run build` passed.

---

# Completion Report — Action Center polish

The three lanes stay: Awaiting decision, Ready to verify, Verification results. Cards show the action, agent, owner, risk id, expected metric, and next step. After approve or verify, the selected action stays selected and the lane follows it. Outcome labels are Improvement observed, Rollback candidate, No material change, Follow-up required, and Verification pending. The approve button reads “Approve governed action.”

Live `/actions?tab=closed` shows one card each: Treasury “View outcome evidence,” phishing “Review rollback path,” platform “Review follow-up.” Those three are already verified, so Approve is not offered again.

Tests: `npm run test:risk-detail` (6 passed). `npm run build` passed.

---

# Completion Report — Risk Detail polish

Risk Detail now leads with the risk title, owner, last seen, and next step. The breach line reads “Unsupported claim rate exceeded threshold: 0.041 observed vs 0.030 allowed.” Impact copy is deterministic by risk category. Evidence is a count plus summaries, with trace ids behind a disclosure. The action strip shows the action title, decision, verification, expected metric, and a state-specific CTA. Verified risks show before/latest/threshold and do not claim automatic remediation.

Checked in the browser: `inc-mrm-001` (View outcome evidence) and `inc-sec-001` (Review rollback path, security impact). Copy tests: `cd apps/web && npm run test:risk-detail` (4 passed). `npm run build` passed.

---

# Completion Report — Phase L

## Reset

`POST /api/v1/simulator/reset-demo` (same as `/reset`) stops the simulator, clears the scenario window, and deletes runtime rows: telemetry, risks, evidence, actions, verification, and correlation clusters. The fleet registry, detection rules, scenario stories, and flagship alias map stay.

```bash
cd apps/web && npm run demo:reset
```

## Scenario commands

From `apps/web`: `demo:baseline`, `demo:stop`, `demo:treasury`, `demo:phishing`, `demo:platform`, `demo:health`.

Walkthrough: `docs/demo/flagship-walkthrough.md` (60-second and 5-minute narration, plus a messy-state fallback).

Health check:

```bash
python3 scripts/demo_health_check.py
```

## Validation

`tests/test_demo_reset.py` and the Treasury pitch e2e passed. Health check passed against the running app, including flagship pages and redirects (`/bob`, `/activity` → `/`; `/controls` → `/systems`; `/usage` → `/`).

The live database was not reset during this check, so the current flagship risks are still there.

## Limitations

Reset is local and destructive for runtime rows. After reset, flagship evidence is 404 until a pitch runs. Pitch commands create the risk; approval and verify still happen in the UI. A verify call with no later telemetry sample is labeled as a story fallback.

---

# Completion Report — Phase K

## Per view

| View | Change |
|------|--------|
| Runtime Monitor | Each row states posture: linked risk, healthy/below threshold, or signal degrading. Raw JSON stays on a secondary tab. Linked events open the risk, not the audit page. |
| Risk Queue | Rows show observed vs allowed under the title. Next-step column uses Review decision, Verify impact, View outcome, Review rollback path, or Review follow-up. |
| Risk Detail | Unchanged layout. Treasury deep link stays selected and the CTA reads View outcome. |
| Action Center | Lanes and one-action-per-risk behavior from Phase H/J kept. |
| Outcomes | Empty state: “Outcomes appear after an action is verified.” Handoffs say Review risk queue and Review governed actions. |
| Agent Fleet | Model cards say Open model and whether the next step is active risks or runtime signals. |
| Overview | Already routes through Review risk queue / Review risk. |

## Files

- `apps/web/components/live-signals/live-signals-feed.tsx`
- `apps/web/components/incidents/incident-queue-workspace.tsx`
- `apps/web/components/evidence-library/evidence-library-app.tsx`
- `apps/web/components/systems-fleet-view.tsx`
- `docs/ai-handoff/completion-report.md`

## Validation

`npm run build` passed. Pages `/`, `/systems`, `/live-signals`, `/incidents`, the three flagship incident links, `/actions`, `/outcomes`, and `/settings` return 200.

Browser check of `/incidents?incident=inc-mrm-001`: Treasury stays selected, the row shows “0.041 observed vs 0.03 allowed”, and the action CTA is View outcome. Phishing and platform rows show their control snapshots.

## Remaining

Older Treasury evidence items still include an earlier “no material change” note beside the improved verification. That is historical evidence, not a second active action.

---

# Completion Report — Phase J

## 1. Loop map

| Step | Where |
|------|--------|
| Generate | `simulator/runner.py` + `generators/mode_traffic.py` → HTTP `POST /api/v1/ingest/events` |
| Ingest | `services/ingest_pipeline.py` |
| Breach | `detection/engine.py` rules, then `correlation/engine.py` |
| Risk | One incident per `tenant:environment:system:diagnosis_family` |
| Evidence | `governance/evidence.py`, read by `GET /governance/evidence/{id}` |
| Action | `ensure_action_for_incident` on create/update and `GET /governance/actions` |
| Approval | `POST /governance/actions/{id}/approve` → status `Approved`, verification `Monitoring` |
| Verify | `verification_eval.py` then `verification.py` |
| Audit | `GET /governance/evidence-library` latest `VerificationOutcomeRow` |
| UI | `useGovernanceData` polls those governance endpoints every 5s and refreshes immediately after approve/verify |

## 2. Data-source audit

| Data | Class |
|------|--------|
| Live spans, incidents, evidence, actions, verification rows | C stored backend state |
| Severity, dedupe, breach snapshot | B governance/rule engine |
| Demo agent mix, rate profiles, story ids, rule thresholds, flagship aliases, action recipes | D deterministic config |
| Story `expected_result` | D, used only when the verification window has no post-action metric sample |
| Risk Queue / Action Center / Outcomes rows | A/C via API. No static queue overrides runtime rows |
| Settings connector catalog | E prototype records, labeled as such. Does not override risks or actions |

## 3. Fallback rule

If a post-action sample exists, verification is computed from it (improved, worsened/rollback, or no material change). The story expectation does not override that sample. If no sample exists, the summary starts with “Story fallback — no post-action telemetry sample…”. Repeating the same outcome updates the existing verification row.

## 4. Generator commands

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulator/start \
  -H 'Content-Type: application/json' \
  -d '{"mode":"continuous","rate_profile":"baseline","profile":"demo","seed":42}'
curl -X POST http://127.0.0.1:8000/api/v1/simulator/stop
curl http://127.0.0.1:8000/api/v1/simulator/status
curl http://127.0.0.1:8000/api/v1/simulator/stories
curl -X POST http://127.0.0.1:8000/api/v1/simulator/scenario-window \
  -H 'Content-Type: application/json' \
  -d '{"story_id":"treasury_grounding_or_model_risk_issue","phases":["degradation"],"events_per_phase":2}'
curl -X POST http://127.0.0.1:8000/api/v1/simulator/scenario-window \
  -H 'Content-Type: application/json' \
  -d '{"story_id":"phishing_security_anomaly","phases":["incident_window","regression"],"events_per_phase":2}'
curl -X POST http://127.0.0.1:8000/api/v1/simulator/scenario-window \
  -H 'Content-Type: application/json' \
  -d '{"story_id":"platform_or_tool_degradation","phases":["incident_window","post_action_verification"],"events_per_phase":2}'
curl -X POST http://127.0.0.1:8000/api/v1/simulator/reset
```

`degradation` is the soft, under-threshold phase. `incident_window` is the breach. Pitch endpoints remain available.

## 5. Sync

Found: a flat or worsened post-action sample could still be labeled with the story’s expected result (phishing rollback even when telemetry did not worsen). Fixed in `verification_eval.py`.

Approve/verify already dispatch `fleetrac-governance-updated`, and the governance hook refreshes immediately. No new cache layer.

CTA for no-material-change is now “Review follow-up”. Rollback CTA is “Review rollback path”.

## 6. Tests and smoke

`tests/test_phase_j_loop_sync.py` plus Phase G/H and action hygiene: passed.
`npm run build`: passed.

Live primary actions: inc-mrm-001 Improvement Observed, inc-sec-001 Rollback Candidate, inc-plat-003 No Material Change.
Pages `/`, `/systems`, `/live-signals`, `/incidents`, `/incidents?incident=inc-mrm-001`, `/actions`, `/outcomes`, `/settings` return 200. `/bob` and `/activity` return 307.

## 7. Deferred

Did not re-fire the three pitches against the live database in this pass; current rows already match those outcomes, and the new test proves telemetry overrides the story when a sample exists. Settings connectors remain prototype data. No frontend test runner was added.

---

# Completion Report — Phase I

## 1. Audit summary

| Surface | Finding |
|---------|---------|
| Overview | Loop and KPIs are clear. Flagship CTAs said “Open {id}” instead of naming the review step. |
| Agent Fleet | Five demo agents, posture badge said “N open” without saying risks. |
| Runtime Monitor | Useful filters and linked-risk distinction. Row CTA was “Open related risk”. |
| Risk Queue | One row per flagship alias, severity language matches the API. Deep link was cleared while the queue was still loading, then a different risk was selected. |
| Risk Detail | Diagnosis and evidence are readable. Metric line was `unsupported claim rate = 0.041 (threshold > 0.03)`. Result CTAs were all “View verification outcome”. |
| Action Center | Three lanes work. One primary action per incident. Result CTAs already differ: Review rollback, View verification, View outcome. |
| Outcomes | Framed as historical audit. Verification outcomes match improved / rollback / no material change. |
| Settings | Copy implied live connectors. It is prototype configuration. |

No frontend test runner exists (`npm test` is not defined). Did not add a new test framework.

## 2. Files changed

- `apps/web/components/incidents/risk-detail-panel.tsx`
- `apps/web/components/incidents/incident-queue-workspace.tsx`
- `apps/web/components/dashboard/governance-insights-dashboard.tsx`
- `apps/web/components/actions/action-center-workspace.tsx`
- `apps/web/components/live-signals/live-signals-feed.tsx`
- `apps/web/components/systems-fleet-view.tsx`
- `apps/web/app/settings/page.tsx`
- `docs/ai-handoff/completion-report.md`

## 3. Wording

- Control breach: “unsupported claim rate exceeded the threshold: 0.041 observed vs 0.03 allowed.”
- CTAs: Review risk, Review risk queue, Review related risk, Inspect telemetry, Send governed action for review.
- Result CTAs follow the existing lane helper: View outcome, Review rollback, View verification.
- Settings: “prototype connector records” and an explicit note that this is not a live integration.
- Fleet badge: “N open risks” / “Healthy”.

## 4. UI

Layouts, nav, and cards stayed in place. Risk rows are keyboard-focusable with a visible focus ring and an accessible name. Action cards expose pressed state and the next-step label.

## 5. Workflow fix

`/incidents?incident=inc-mrm-001` stayed on Treasury after load. Previously the queue cleared the selection while data was loading and then picked another risk.

## 6. Tests

No new frontend suite. Backend: `tests/test_action_hygiene.py`, `tests/test_phase_h_actions.py`, `tests/test_phase_g_runtime_risks.py` — 11 passed. `npm run build` passed.

## 7. Manual smoke

- `/`, `/incidents`, `/actions`, `/outcomes`, `/settings`, `/live-signals`, `/systems` return 200.
- `/bob` and `/activity` return 307.
- Action Center verification-results lane shows exactly three actions: inc-sec-001 Review rollback, inc-plat-003 View verification, inc-mrm-001 View outcome.
- Evidence library still has `improvement_observed`, `rollback_candidate`, `no_material_change`.

## 8. Deferred

- Some older evidence items on Treasury still mention an earlier “no material change” note beside the improved verification. That is historical evidence, not a second active action.
- Settings still lists prototype connectors; only the page framing was made honest.
- Healthy-baseline spam was not re-run this pass; existing detection tests still require a threshold cross before a risk is created.

---

# Completion Report — Action Center hygiene

## Summary

Default Action Center list now returns one primary governed action per incident. Extra pre-Phase-H “Remediate —” rows are marked `Superseded` and kept in the database. `GET /governance/actions?include_history=true` still returns them.

**Primary rank:** verified recipe action, then open recipe action, then other open rows, then older legacy. `ensure_action_for_incident` does not create another row when a primary already exists.

## Smoke

| Alias | Primary status | Verification |
|-------|----------------|--------------|
| inc-mrm-001 | Closed | Improvement Observed |
| inc-sec-001 | Rollback candidate | Rollback Candidate |
| inc-plat-003 | Monitoring | No Material Change |

Evidence library still shows `improvement_observed`, `rollback_candidate`, and `no_material_change`. Two Treasury legacy rows are `Superseded`.

## Tests

`tests/test_action_hygiene.py` and Phase H action tests passed. Frontend build passed.

---

# Completion Report — Phase H

## Summary

Runtime risks now link to one open governed action and a deterministic verification result. The existing `GovernedActionRow` / `VerificationOutcomeRow` models and `POST /governance/actions/{id}/verify` endpoint were extended. No parallel action model, no LLM, no IA change.

## Action linking

On incident create/update (`correlation/engine.py`) and on `GET /governance/actions`, `ensure_action_for_incident` attaches a recipe-based action.

**Dedupe key:** `incident_id` + non-terminal status (`Awaiting approval`, `Approved`, `Monitoring`). Terminal statuses (`Closed`, `Rejected`, `Rollback candidate`, `Policy-blocked`) do not block a later action.

Flagship recipes:

| Alias | Title | Metric | Direction | Rollback | Expected result |
|-------|--------|--------|-----------|----------|-----------------|
| inc-mrm-001 | Tighten Treasury grounding and review unsupported-claim guardrail | unsupported_claim_rate | decrease | no | improvement_observed |
| inc-sec-001 | Rollback security tool-scope change and review escalation boundary | tool_scope_violation | decrease | yes | rollback_candidate |
| inc-plat-003 | Review platform/tool degradation and verify latency recovery | latency_ms | decrease | yes | no_material_change |

Approve still sets status `Approved` and verification `Monitoring` (Action Center “ready to verify”).

## Verification evaluator

`verification_eval.evaluate_verification` compares breach baseline (`worst_observed_value`) to the latest post-approval telemetry for the expected metric:

- worsened → `rollback_candidate` if rollback-eligible, else `regression_detected`
- clears threshold or moves ≥10% in the expected direction → `improvement_observed`
- otherwise → `no_material_change` (phishing expected rollback stays `rollback_candidate` when still not improved)
- no post-action sample → story `expected_result`

An operator-supplied `outcome` on `POST .../verify` is preserved. The response includes baseline, post-action value, threshold, window, evidence refs, and follow-up text. Evidence Library items expose `verification_outcome` / `verification_summary`.

## Files changed

| Path | Change |
|------|--------|
| `apps/api/app/db/models.py` | Action recipe fields; verification snapshot columns |
| `apps/api/app/governance/action_recommendations.py` | **add** — deterministic recipes |
| `apps/api/app/governance/actions.py` | `ensure_action_for_incident` dedupe |
| `apps/api/app/governance/verification_eval.py` | **add** — metric comparison |
| `apps/api/app/governance/verification.py` | Persist evaluated result; operator outcome wins |
| `apps/api/app/correlation/engine.py` | Link action on create/update |
| `apps/api/app/api/routes/governance.py` | Richer actions list + verify response; optional outcome |
| `apps/api/app/governance/read_models.py` | Evidence library verification fields |
| `apps/api/tests/test_phase_h_actions.py` | **add** |
| `apps/web/lib/governance-api.ts` | DTO fields |
| `apps/web/lib/governance-merge.ts` | Outcomes copy from verification |
| `docs/ai-handoff/completion-report.md` | This report |

## Endpoints

- `POST /api/v1/governance/incidents/{id}/actions` — returns existing open action
- `GET /api/v1/governance/actions` — backfills missing open actions; lane fields unchanged (`status`, `verification_status`)
- `POST /api/v1/governance/actions/{id}/approve`
- `POST /api/v1/governance/actions/{id}/verify` — outcome optional; auto-evaluates when empty
- `GET /api/v1/governance/evidence-library` — verification outcome + summary

## Tests / smoke

| Check | Result |
|-------|--------|
| `tests/test_phase_h_actions.py` | passed |
| Action approve/reject + full pitch e2e | passed |
| Live: inc-mrm-001 verify | `improvement_observed` (baseline 0.041) |
| Live: inc-sec-001 verify | `rollback_candidate` |
| Live: inc-plat-003 verify | `no_material_change` |
| Evidence library shows all three outcomes | passed |
| `npm run build` | passed |
| Frontend `/`, `/actions`, `/outcomes` | restarted; confirm HTTP 200 |

## Limitations

- Pre-Phase-H Treasury handoffs left extra open `Remediate —` rows. New breaches do not add another while one is open; only the newest open row receives recipe fields.
- Auto-verify uses story `expected_result` when no post-approval metric sample exists yet.
- Did not delete legacy actions or redesign Action Center lanes.
