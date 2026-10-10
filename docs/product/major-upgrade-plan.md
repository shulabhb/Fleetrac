# Fleetrac major upgrade plan

**Status:** Planning only. Do not implement this whole document in one pass.  
**Date:** 2026-10-10  
**Branch at plan time:** `ImplementationV1` @ `7748ebf` (pushed)

This plan turns the workflow diagrams into a **repeatable product loop** that a manager, supervisor, risk owner, or developer can follow without needing the internals.

Core rule (do not dilute):

> **Risk Detail explains. Action Center decides. Outcomes Audit proves.**

A next-step button must land where the person can **do the next job**, not where they already were.

---

## 0. What is already true (do not rebuild)

The loop already exists as a prototype. The last commit closed the worst hole: verification results that looped forever.

| Piece | Today |
|---|---|
| Telemetry in | Simulator posts OTEL-style traces to `POST /api/v1/ingest/events` |
| Detect + group | Rules + 15-minute correlation → **one evolving risk** per cluster |
| Evidence | Packaged record + **Fleetrac Analysis** (template, not a model yet) |
| Decide | Action Center: approve / reject |
| Verify | Action Center: improvement / rollback / no material change |
| Record after verify | Action Center panels + `resolution_status` on the same action |
| Next-step map | Shared helper `apps/web/lib/resolve-next-step.ts` |

Flagship stories already map:

| Alias | Story | After verify |
|---|---|---|
| `inc-mrm-001` | Treasury unsupported claim | Improvement → close-ready |
| `inc-sec-001` | Phishing tool scope | Rollback candidate → stays open until a decision is recorded |
| `inc-plat-003` | Routing / latency | No material change → stays open until follow-up is recorded |

**Do not** add a second pipeline, a second ID scheme, or a new top-level “workflow engine” page. Extend this spine.

---

## 1. The closed loop, in plain language

Think of Fleetrac as a **shared notebook for agent risk**, not a debugger.

```
Something in the live run looks off
        ↓
Fleetrac opens (or updates) one risk
        ↓
Risk Detail: “What happened, why it matters, here is the evidence”
        ↓
Action Center: “Here is the bounded recommendation — approve, reject, or later record how we handled it”
        ↓
After approval, we watch the same signal
        ↓
Outcomes Audit: “Here is proof of what we saw before and after — and the decision we recorded”
```

### Who owns which page

| Page | Job in one sentence | Typical person |
|---|---|---|
| Overview | What needs attention first? | Manager / supervisor |
| Runtime Monitor | Is the fleet noisy or quiet right now? | Operator / developer |
| Risk Queue | Which open risks should I pick up? | Risk owner |
| Risk Detail | Help me understand this risk | Everyone |
| Action Center | I am making or recording a decision | Risk owner / approver |
| Outcomes Audit | Show me the proof and history | Audit / manager |
| Agent Fleet | Which agents are in scope? | Everyone |
| Code Investigations | Optional: look at the agent’s repo for a likely cause | Developer (later) |
| Settings | Connectors and demo controls | Operator |

### Closing the loop (the part that used to confuse us)

Verification is **not** the end. It is a **result**. Then a human records what the team will do.

| After verify | Risk still open? | Next human job | Where |
|---|---|---|---|
| Improvement observed | Close-ready (should **not** auto-vanish until someone records resolved / keep monitoring) | Review proof, then mark resolved or keep watching | Action Center close-ready panel; Outcomes holds proof |
| Rollback candidate | Yes | Record rollback required, handled outside, follow-up, or keep watching | Action Center rollback panel |
| No material change | Yes | Record follow-up, accept risk, handled outside, or keep watching | Action Center follow-up panel |
| Regression | Yes | Go back to understanding the risk (critical review) | Risk Detail |
| Reject / block | History | No action proceeds; keep the record | Outcomes / history |

Fleetrac **never** claims it rolled back code, deployed a fix, or changed the agent. It **records**.

---

## 2. Known gaps vs the diagrams (the real remaining work)

These are the mismatches to fix, in order, instead of a rewrite.

1. **Improvement currently auto-closes the risk in the API.** The diagrams want close-ready first, then a human mark. Align backend with that.
2. **Regression is folded into “rollback” in the UI helper.** Diagrams want a separate “critical review → Risk Detail” path.
3. **Next-step logic lives in the frontend.** Backend should return `current_stage` + `next_required_step` so every surface (including notifications) cannot drift.
4. **Overview / notifications copy is still mixed** (“review this risk” vs state CTAs).
5. **Evidence Library and Outcomes Audit share `/outcomes`.** Proof vs library is easy to confuse. Keep the URL; clarify the job in copy and filters.
6. **Simulator pitches stop at “risk exists.”** They do not walk approve → verify → record as a guided story. Demo still needs a human to click, but the log stream should make the story obvious.
7. **Log snippets are still engineer-shaped.** Managers need a short “what we saw” card with an optional raw snippet.
8. **Code Investigations is a blank nav item.**
9. **Fleetrac Analysis is a template.** The intelligence layer should *draft explanations*, not run the control plane.
10. **Nav is heavier than the seven-item spine** (Code Investigations + both Evidence Library and Outcomes Audit). Treat Code Investigations as **optional context**, not a required loop step.

---

## 3. How we will execute (one slice at a time)

Each slice has **one flagship proof**, tests, and a “do not touch.”  
A later slice may use earlier work; it must not redesign it.

```
Slice A  Language + closure truth (backend + resolver)
Slice B  Page jobs + CTAs (frontend only)
Slice C  Readable evidence + log snippets
Slice D  Simulator stories that mimic the full loop
Slice E  Code Investigations (optional repo, read-only)
Slice F  Local/small model for drafts only
```

If a slice is messy, stop. Do not start the next slice.

---

## Slice A — Make the lifecycle one source of truth

**Why first:** If close/open meaning is wrong, every later page and demo lies.

**Human outcome:** After verify, the product says the same thing on Overview, Queue, Detail, Action Center, and Outcomes.

**Backend**

- Keep SQLite. Add nothing new if `resolution_*` already covers it (it does).
- Stop auto-closing on `improvement_observed`. Set lifecycle to Verification / close-ready; close only on `resolved`, `risk_accepted`, or `externally_handled`.
- Treat `regression_detected` as **critical review**, not as rollback, unless the recorded outcome is `rollback_candidate`.
- Add a small **read model** on incident/action GET, for example:

```text
current_stage
current_stage_label
next_required_step
primary_cta
primary_destination   (risk_detail | action_center | outcomes)
closure_state         (open | close_ready | closed | monitoring)
resolution_status
```

Frontend `resolveIncidentLifecycle` becomes a display adapter of this payload, with a local fallback only if the API is old.

**Do not:** new tables, Postgres, Redis.

**Prove with:** pytest on treasury (stays close-ready until resolve), phishing (stays open until rollback recorded), platform (stays open until follow-up recorded). Alias IDs unchanged.

**Done when:** Recording “Mark risk resolved” is what removes the risk from the active queue; verification alone does not.

---

## Slice B — Frontend workflows, as simple as possible

**Why:** People get lost when every page tries to do every job.

**Page-by-page (keep current routes)**

| Page | Simplify to | Primary click |
|---|---|---|
| Overview | 3–7 “needs you” rows with **one** next step | That CTA (not always the drawer) |
| Risk Queue | Open risks only; closed belongs in Outcomes | Title → Detail; CTA → destination from resolver |
| Risk Detail | Explain + next step. Approve/verify **controls** may stay as shortcuts, but the **headline CTA** leaves when the job is decide/verify/record | Matches table in the diagrams |
| Action Center | List + detail. Deep link selects the card. Resolution panels already exist | Do the decision on this page |
| Outcomes Audit | Proof for this risk: before/after, decision note, log snippets | Open rollback/follow-up/close-ready if still needed; **never** “Review this risk” as the only button |
| Runtime Monitor | Live movement. Link to a risk only if one exists | Optional “Open this risk” |
| Agent Fleet | Which agent, owner, whether it has an open risk | Open risk or monitor |
| Notifications | Same labels as Overview | Same destinations |

**Copy rules (all pages)**

- Prefer “risk” over “incident” in user-facing chrome where it is cheap.
- Always: “Fleetrac recorded this. It did not change agent code.”
- One next required step. Secondary is allowed. Tertiary is a text link.

**Do not:** IA redesign, new pages, second resolver.

**Prove with:** Click `inc-sec-001` “Review rollback path” → panel with Record rollback required, not another identical button. Same for follow-up and close-ready.

---

## Slice C — Human-readable evidence and log snippets

**Why:** The product is for mixed audiences. Raw OTEL is for developers; the default view is a story.

**What a non-developer should see on Risk Detail / Outcomes**

1. **What we noticed** — one sentence  
2. **Why it matters** — severity in words (“this can widen who gets quarantined”)  
3. **What we compared** — observed vs allowed (the numbers they already have)  
4. **A short log snippet** — 5–15 lines, highlighted phrase, “show more” for raw JSON  
5. **What we recommend** — bounded action, not “AI will fix it”

**Backend:** store snippet pointers on existing evidence items (`span_id`, `trace_id`, already on events). No new blob store.

**Do not:** a log product, Elasticsearch, or hiding raw logs from developers.

**Prove with:** A manager can explain `inc-mrm-001` from the snippet card without opening the raw panel.

---

## Slice D — Log / simulator stories that mimic the loop

**Why:** Demos and tests must replay the four stories, not only “open a risk.”

**Keep:** HTTP ingest only. Impact modes mutate **facts**, not final severity.

**Add story beats** (same generators, clearer windows):

| Beat | What the logs show | What Fleetrac should show |
|---|---|---|
| Healthy | Quiet, in-threshold | Runtime Monitor only |
| Breach | Repeated bad eval / latency / tool scope | Risk opens |
| While open | Related spans attach to **same** risk | One card, highest severity |
| After approve | Optional healthier or worse window (already partly there) | Ready to verify, then outcome |
| After record | Healthy or continued watch | Queue / Outcomes match the recorded decision |

**Demo controls (Settings, human labels)**

- “Show the Treasury story (it got better)”  
- “Show the phishing story (rollback review)”  
- “Show the routing story (did not really help)”  
- Reset demo  

Each control still hits existing pitch endpoints, then the UI copy tells the operator **what click comes next**.

**Do not:** a second simulator, writing incidents from the generator, cloud log vendors.

**Prove with:** Reset → pitch phishing → approve → verify rollback → record rollback required → Overview no longer says only “Review rollback path.”

---

## Slice E — Code Investigations (optional, in-scope diagnosis)

**Intent:** Fleetrac *may* look at the agent’s repository to suggest **why** a risk might be happening, if that cause is in Fleetrac’s lane (grounding, tool allow-list, routing timeout, prompt/policy config). It is **not** a copilot that patches production.

**Product shape**

- Not required to close the governance loop. Loop works with Code Investigations empty.
- Entry: from Risk Detail, a quiet “Look at connected code (optional)” when a repo is linked on that agent in Settings.
- Output: **candidate cause + file/hunk citations + “this is a hypothesis.”** Never “Fleetrac found the bug and will fix it.”
- No commit, no PR, no write access in v1.

**v1 connection (smallest useful)**

- Settings: paste a **git URL** (GitHub HTTPS) + optional subdirectory / default branch for that fleet system.
- Store on the existing system row (new columns: `repo_url`, `repo_ref`, `code_access = none | read`).
- On demand: shallow clone or fetch into a local cache dir under `apps/api/data/repos/` (gitignored).
- Search is **bounded**: query terms from the risk (tool name, metric, “allowlist”, “timeout”), max files, no whole-repo dump to a model.

**Out of scope until asked:** OAuth app, writing PRs, scanning secrets, running the agent.

**Prove with:** Phishing risk + a fixture repo that contains an overly broad tool name → a cited snippet. Treasury with no repo → the button is disabled with “No repository connected.”

---

## Slice F — Lightweight intelligence layer (drafts only)

**Intent:** A small local (or free) model that **writes explanations and candidate diagnoses**. Detection, correlation, severity, and approval stay **deterministic**. The model never opens risks, never approves, never resolves.

**Recommended v1 runtime:** **Ollama** on the operator laptop.

| Model size | Role |
|---|---|
| Default: `llama3.2:3b` or `qwen2.5:3b` | Fits 8–16 GB machines; good enough for short summaries |
| Optional: `phi3:mini` | Even lighter |
| Fallback | Keep today’s template Fleetrac Analysis if Ollama is down |

Why this vs a paid API: you asked for **free / local / comfortable**. Ollama is that. A hosted free tier (e.g. Groq) can be a later Settings toggle, not the foundation.

**Jobs the model is allowed to do**

1. **Fleetrac Analysis draft** — given structured facts (system, metric, observed vs allowed, rule id, 1–3 snippets), write the three existing fields: what we saw, likely cause, governance implication.  
2. **Log snippet title** — one sentence over a span.  
3. **Code Investigations hypothesis** — given risk facts + 2–5 cited hunks, say whether the hunk is relevant. If unsure, say so.

**Jobs it must not do**

- Invent a metric, severity, or approval.
- Claim the code change was applied.
- Call tools that mutate the agent.

**Backend shape**

- `apps/api/app/intelligence/` with a `DraftClient` (`ollama` HTTP `localhost:11434`).
- Persist drafts on the evidence/analysis record: `analysis_source = template | model`, `model_id`, `prompt_version`.
- Operator can “Keep template” vs “Use draft.” Human is the publisher.

**Prove with:** Ollama off → template still works. Ollama on → treasury analysis is readable and still shows the same numbers as the evidence card.

---

## 4. Data: stay on SQLite, store only what the loop needs

Already stored (keep): raw events, normalized events, incidents, evidence, actions, verification outcomes, severity history, `resolution_*`.

Add only when the slice needs it:

| Slice | Maybe add |
|---|---|
| A | Nothing if read model is computed |
| C | Optional `snippet_text` cache on evidence item |
| E | `repo_url`, `repo_ref` on `systems`; gitignored clone cache |
| F | `analysis_source`, `model_id` on analysis JSON |

Correlation stays as it is: **one risk per cluster key**, 15-minute window, highest severity wins. Do not rebuild correlation for the upgrade.

---

## 5. What “perfect each slice” means

A slice is mergeable only when:

- Flagship aliases still work.
- Empty states are empty (no new fake catalogs).
- Trust language holds.
- Tests cover that slice’s behavior.
- You can demo the slice **without** explaining the next slice.

Suggested demo script after all slices (not the first milestone):

1. Reset demo.  
2. Run phishing story.  
3. Overview → Review rollback path → record rollback required.  
4. Outcomes still has the evidence.  
5. Optional: open Code Investigations hypothesis.  
6. Optional: show model draft vs template.

---

## 6. Explicit non-goals (until you ask)

- Postgres, Redis, Kafka, Kubernetes  
- Real Slack / Jira  
- RBAC  
- Autonomous agents that approve or patch  
- Redesigning navigation from scratch  
- A second “AI copilot” product surface  

---

## 7. Questions (please answer before Slice E/F; Slice A can start on the defaults below)

**Q1. Improvement auto-close**  
Default in this plan: **stop auto-closing**; human marks resolved.  
Confirm, or keep auto-close and only use the close-ready panel as extra recording?

**Q2. Code Investigations visibility**  
Default: keep the nav item, but the page says “Optional. Connect a repo in Settings. You can finish governance without this.”  
Or hide the item until a repo is connected?

**Q3. Model hosting**  
Default: **Ollama local** (`llama3.2:3b`).  
Or do you want a hosted free API (Groq/etc.) so demos work without installing Ollama?

**Q4. Repo access**  
Default v1: public HTTPS URL + shallow clone.  
Do you need private GitHub (token in Settings) in the first Code Investigations slice?
