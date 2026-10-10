# Current Task

## Objective

Add a real operator resolution step after verification so rollback / follow-up / improvement states do not loop between Risk Detail, Action Center, and Outcomes.

## Scope

- `resolution_status` / `resolution_note` on governed actions
- `POST /governance/actions/{id}/resolve`
- Action Center rollback / follow-up / close-ready panels
- Shared lifecycle next-step updates after a recorded decision
- Outcomes Audit CTAs that open the matching review, not a generic Risk drawer loop

## Out of Scope

- New pages or nav
- Real rollback / Slack / Jira / LLM
- Duplicate actions

## Acceptance Criteria

- [x] Review rollback path lands on operator choices
- [x] Recording a decision changes the next step
- [x] Improvement can be marked resolved and leaves the active queue
- [x] Fleetrac records decisions only — it does not execute rollback
- [x] Tests + Next build pass
