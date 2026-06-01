# Release Checklist

## Reusable Release Readiness

Every release Harness Issue must include README freshness in its Acceptance Criteria or Gate section before external release actions.

- [x] README freshness confirmed against the current starter surface.
- [x] README install commands point to the public `dongwonlee222/POKit2` repository only.
- [x] README explains the sanitized starter boundary.
- [x] README explains issue workflow, verification layers, file structure, runtime setup, project scaffold, and archive instructions.
- [x] README does not claim package-registry, hosted service, or unproven runtime support.
- [x] Public starter scan confirms no real issues, specs, memory, run logs, receipts, private paths, secrets, or Dongwon-specific work artifacts are included.
- [x] Verification layers are separated as doctor, tests, evals, receipts, metrics, retro, and QA.
- [x] Public scaffold folders contain marker files only, not real project work.
- [x] Starter ships user-facing standalone scripts for issue creation, issue listing, evidence listing, startup metrics, sprint retro close, and smoke tests.
- [x] Starter does not ship full development `scripts/lib`, hooks, provider adapters, or internal regression tests.

## Release Identity

- Version: `v0.13.0`
- Type: local starter archive / release gate evidence
- Date: 2026-06-02
- Status before external actions: `local archive ready; external publish not performed`

This prepares the v0.13.0 public starter install archive after the multi-project/multi-session starter lane and onboarding docs completed. External publish actions still require separate PO approval.

## Artifact

- File: `release/pokit-starter-v0.13.0.tar.gz`
- Source boundary: `starter-manifest.yaml` include entries only
- Mapping: `starter/.ai-os/**` -> `.ai-os/**`; `starter/.claude/**` -> `.claude/**`; `starter/scripts/**` -> `scripts/**`
- User runtime: runner, doctor, issue-create, list-issues, list-evidence, measure-startup, sprint-close, starter smoke test
- Public target repository: `dongwonlee222/POKit2`

Recorded in the release evidence outside the starter archive:

- SHA-256: see `release/v0.13.0.md`
- Bytes: see `release/v0.13.0.md`
- Public URL: pending until stable GitHub release

## Preflight

- [x] `node scripts/pokit-create-starter-archive.mjs release/pokit-starter-v0.13.0.tar.gz`
- [x] `node scripts/pokit-starter-self-test.mjs`
- [x] Extracted archive runner passes.
- [x] Extracted archive doctor passes.
- [x] Extracted archive smoke tests pass.
- [x] Focused starter/public README checks pass.
- [ ] `node --test tests/*.mjs`
- [x] `node scripts/pokit-doctor.mjs`
- [x] `git diff --check`
- [x] Archive safety scan finds no private paths, secrets, run logs, event receipts, real issue history, or real sprint memory.

## External Actions

- [x] Public repository target confirmed: `dongwonlee222/POKit2`
- [x] No accidental push to private development repo as the public install source.
- [ ] Stable public tag confirmed.
- [ ] Public README updated.
- [ ] Release archive attached or install path documented.
- [ ] External install test completed against published v0.13 artifact/path before stable promotion.

## Explicit Non-Actions

- No npm, pip, Homebrew, Docker, or package-registry publish.
- No hosted service launch.
- No claim that Codex, Claude, or Antigravity support is fully proven without fresh runtime proof.
- No stable `v0.12.0` release claim before stable public release evidence is recorded.

## GitHub Repository Metadata

Recommended description:

```text
Local-first AI work harness for issue-driven PO/product work.
```

Recommended topics:

```text
ai, product-management, po, agents, local-first, starter, harness, issue-driven
```
