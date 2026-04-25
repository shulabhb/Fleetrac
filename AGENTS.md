# AGENTS.md

## Mission
Fleetrac is an observability-driven governance control plane for production AI systems.
Primary operator persona: Fleet Governor (full access).
Core workflow loop: Observe -> Investigate -> Act -> Measure.

## Refactor Intent
- Current goal is friction reduction and workflow clarity, not net-new capability.
- Keep the product feeling like one operating loop, not disconnected rich surfaces.
- Focus on page ownership clarity and above-the-fold hierarchy on key routes.

## Product Guardrails
- Preserve existing IA unless a workflow ownership change is explicitly approved.
- Keep canonical trust language:
  - Bob is bounded, policy-checked, approval-gated, audit-linked, and reversible by default where supported.
  - Do not present Bob as unrestricted autonomous AI.
- Keep Action Center as governed action decision surface.
- Keep Outcomes as post-remediation measurement and evidence surface.
- Do not remove existing capabilities while simplifying UX.

## Routing and Navigation Rules
- Use `apps/web/lib/routes.ts` builders for internal links; do not hand-assemble object URLs.
- Preserve scoped deep links and exact-object routing.
- Preserve continuity behavior with `appendReturnTo(...)` and `safeReturnTo(...)`.
- Preserve Settings deep-link behavior (`tab`, `integration`) and integration drilldowns.

## URL State and Query Param Rules
- URL query params are canonical UI state where currently used.
- Keep existing param names/semantics unless an approved migration updates all producers/consumers.
- Maintain current cross-page patterns for:
  - Actions: `tab`, `q`, `risk`, `type`
  - Outcomes: `tab`, `q`, `env`, `type`, optional `system`
  - Bob: `status`, `target`, `confidence`, `sort`, `q`, `missing`
  - Incidents: `system`, `severity`, `risk`, `owner`, `lifecycle`, `q`, `rule` (control / `rule_id` scope)
  - Settings: `tab`, `integration`

## Canonical Terminology and Status Rules
- Reuse centralized helpers and avoid duplicate label maps:
  - `apps/web/lib/governance-states.ts`
  - `apps/web/lib/integration-access-vocabulary.ts`
  - `apps/web/components/actions/action-badges.tsx`
  - `apps/web/components/operations/operations-badges.tsx`
- Keep enterprise operational tone; avoid marketing copy.

## UI and Design Conventions
- Keep enterprise visual style: restrained, data-dense, high-signal.
- Prefer existing shared primitives (`Card`, `Badge`, `SectionTitle`, `Select`).
- Do not add flashy visuals or ornamental animation.
- Preserve shell stability and route-level loading behavior.

## Architecture and Reuse Rules
- Prefer extending shared helpers/components over introducing parallel patterns.
- Keep API access centralized through `apps/web/lib/api.ts`.
- Keep backend route taxonomy aligned with Observe/Investigate/Act/Measure domains.
- Preserve capability while reducing cognitive overhead.

## Quality Gates (before finalizing)
- Lint and type checks pass.
- Web build passes.
- Deep links and route builders still resolve correctly.
- No regression in list -> detail -> back continuity.
- No package/dependency drift in monorepo app scopes.

## Process Rule for Broad Refactors
1. Propose and confirm ownership + IA adjustments first.
2. Implement in small staged changes (routing/state before large layout shifts).
3. Re-verify continuity, trust language, and workflow loop coherence.
