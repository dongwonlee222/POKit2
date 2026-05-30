# pokit-backlog

Use this skill when the user wants to create, modify, groom, or clarify issue definitions before execution.

## Contract

- Read `.ai-os/current.md` first.
- Treat `.ai-os` as the source of truth.
- Recommend issue changes before writing files.
- Keep work scoped to issue definition, acceptance criteria, readiness, dependencies, and backlog order.
- Do not perform implementation work or claim gates from this skill.

## Workflow

1. Identify the request class: new issue, issue update, acceptance criteria, readiness, dependency, or sprint placement.
2. Inspect the relevant `.ai-os` issue/index files.
3. Produce a concise recommendation.
4. After approval, edit the relevant issue state.
5. Run `node scripts/pokit-doctor.mjs`.
6. Report changed files and verification evidence.

## Output

Return a short Korean summary by default:

- what changed
- where it was saved
- what verification ran
- what the next action is
