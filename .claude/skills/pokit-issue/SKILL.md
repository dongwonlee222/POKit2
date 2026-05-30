# pokit-issue

Use this skill when the active issue is ready and the user explicitly approves execution.

## Contract

- Read `.ai-os/current.md` before durable work.
- Execute only the active issue.
- Do not create, groom, or redefine issues from this skill.
- Keep the main session responsible for state, integration, verification, and gate claims.
- Use workers or subagents only for scoped evidence, not final gate decisions.
- Do not claim done without verification evidence.

## Workflow

1. Confirm active issue and gate state from `.ai-os/current.md`.
2. Run `node scripts/pokit-runner.mjs "진행해줘"` for a preview when useful.
3. Implement the issue in the smallest coherent change.
4. Run focused tests or checks.
5. Run `node scripts/pokit-doctor.mjs`.
6. Update issue/status/memory surfaces only when the gate evidence supports it.

## Verification Layers

- doctor: structural and state checks
- tests: regression checks
- evals: judgment or workflow scenarios when applicable
- receipts: routing, release, or audit evidence when applicable
- QA: manual or external install checks when applicable

## Output

Return:

- changed files
- verification commands and result
- gate status
- next action
