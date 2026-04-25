# REFACTOR_BRIEF.md

## Purpose
This brief defines the current-state refactor target for Fleetrac.
The target is UX/workflow coherence for the Fleet Governor daily loop, not feature expansion.

## Product Context
- Fleetrac is an observability-driven governance control plane for production AI systems.
- Core loop: Observe -> Investigate -> Act -> Measure.
- Main surfaces: Dashboard, Incident Queue, Governance Controls, Systems, Action Center, Outcomes, Bob Copilot, Settings.
- Fleet Governor is primary persona for this version (full access).

## Already Implemented (Do Not Remove)
- Incident detection and triage workflows
- Bob investigation flows (list/detail/target resolver)
- Governed action preparation, approval, and execution tracking
- Outcome measurement (expected vs actual impact, rollback/follow-up semantics)
- Integrations/settings/access-policy surfaces
- Cross-surface deep links and continuity helpers (`returnTo`, breadcrumbs)

## Refactor Problem Statement
The app is functionally rich, but day-to-day operation has friction due to competing page density and unclear ownership boundaries.

## Refactor Goals
1. Reduce Fleet Governor cognitive overhead during daily operations.
2. Clarify ownership by page inside Observe/Investigate/Act/Measure.
3. Improve above-the-fold prioritization on key routes.
4. Make the loop feel continuous across pages.
5. Preserve all existing capabilities and trust posture.

## Non-Negotiable Constraints
- Do not break the governance narrative:
  - Bob is bounded, policy-aware, approval-gated, and audit-linked.
- Do not reposition Action Center away from governed action decisions.
- Do not reposition Outcomes away from post-remediation evidence/measurement.
- Do not break routing conventions, query-param semantics, or continuity behavior.
- Do not introduce flashy UI or non-enterprise tone.

## Canonical Technical Conventions
- Route construction must use `apps/web/lib/routes.ts`.
- Keep URL-state patterns for filters/tabs aligned with current behavior.
- Preserve and reuse canonical status/label helpers:
  - `apps/web/lib/governance-states.ts`
  - `apps/web/lib/integration-access-vocabulary.ts`
  - `apps/web/components/actions/action-badges.tsx`
  - `apps/web/components/operations/operations-badges.tsx`
- Keep API access centralized in `apps/web/lib/api.ts`.

## High-Priority Files to Inspect First
- `apps/web/lib/routes.ts`
- `apps/web/lib/api.ts`
- `apps/web/lib/nav.ts`
- `apps/web/lib/governance-states.ts`
- `apps/web/lib/integration-access-vocabulary.ts`
- `apps/web/lib/present.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/actions/page.tsx`
- `apps/web/components/actions/action-center-view.tsx`
- `apps/web/app/outcomes/page.tsx`
- `apps/web/components/operations/outcomes-view.tsx`
- `apps/web/app/bob/page.tsx`
- `apps/web/components/bob/bob-copilot-view.tsx`
- `apps/web/app/settings/page.tsx`
- `apps/web/components/operations/settings-view.tsx`
- `apps/web/components/operations/settings-integrations-tab.tsx`
- `apps/web/components/shared/flow-breadcrumb.tsx`

## Known Drift Traps
- Segment/tab constants duplicated across files (risk of mismatch).
- Settings `tab` + `integration` interplay can produce subtle behavior drift.
- API schema vs frontend type duplication risks contract drift.
- Controls detail is the object route `/controls/[id]` (list search remains `?q=` on `/controls`).
- Mixed URL-state bootstrapping patterns in some client views.

## Recommended Implementation Order
1. Confirm page ownership matrix (what each route owns above the fold).
2. Rationalize above-the-fold content for Dashboard, Action Center, Outcomes, Settings.
3. Normalize tab/filter/query conventions where duplicated.
4. Consolidate any duplicate status/label mappings into canonical helpers.
5. Validate continuity flows and deep-link behavior end-to-end.
6. Run lint/type/build checks and fix regressions.

## Definition of Done
- Workflow feels tighter for daily Fleet Governor operation.
- Ownership boundaries are clearer across loop surfaces.
- No capability regressions.
- Canonical trust language and routing/state conventions preserved.
