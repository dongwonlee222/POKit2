# /pokit.issue

Use this command when the active issue is ready for execution and the user explicitly approves progress.

Recommended flow:

1. Read `.ai-os/current.md`.
2. Confirm the active issue and gate state.
3. Run `node scripts/pokit-runner.mjs "진행해줘"` for the execution preview.
4. Implement the approved issue.
5. Run verification before claiming completion.

Issue execution owns implementation and gate evidence. It does not create or groom new issue definitions.
