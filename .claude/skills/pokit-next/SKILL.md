# pokit-next

Use this skill when the current issue has passed its gate and the user wants to continue to the next issue.

## Contract

- Read `.ai-os/current.md` first.
- Move only after gate evidence exists.
- Preserve user-created issue state.
- Keep next issue selection explainable.

## Workflow

1. Confirm the current gate is passed.
2. Inspect the issue index or sprint plan.
3. Select the next ready issue.
4. Update `.ai-os/current.md` and status surfaces.
5. Run `node scripts/pokit-doctor.mjs`.
6. Present the new active issue and next action.

## Output

Return:

- previous issue
- new active issue
- why it was selected
- verification result
