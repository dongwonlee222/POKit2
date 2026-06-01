# Changelog

This public changelog tracks the sanitized starter kit only. Internal development issues, sprint memory, receipts, and work history are intentionally excluded from the public starter.

## [0.12.0] - 2026-05-31

### Changed

- Promoted the public starter from `v0.12.0-rc.6` to stable `v0.12.0` after fresh external QA.
- Starter install instructions now point to the stable release archive.
- Public starter wording and executable guards are aligned for clarify markers, issue transition blocking, beginner issue creation/list/use flow, and worker/fallback evidence.

### Verification

- Stable release keeps package-registry and hosted-service publishing out of scope.
- Public starter release is based on the sanitized starter manifest, not the private development issue history.

## [0.12.0-rc.2] - 2026-05-30

### Changed

- README and architecture docs now separate verification layers into `doctor`, `tests`, `evals`, `receipts`, `metrics`, `retro`, and `QA`.
- Runtime setup now explains why `.claude/commands` and `.claude/skills` are present, and how Codex installs the sanitized skills into `~/.codex/skills` or `$CODEX_HOME/skills`.
- File structure docs now show the public-safe scaffold folders for future user issues, docs, artifacts, and sprint state.

### Added

- Empty scaffold markers for `projects/`, `docs/`, `artifacts/`, and `.ai-os/sprints/` in the starter archive.
- Standalone user-facing starter scripts for issue creation, issue listing, evidence listing, startup metrics, and sprint close/retro setup.
- Minimal `tests/starter-smoke.test.mjs` so users can run a starter-level test without inheriting POKit2's private development regression suite.

### Not Included

- Real user issues, specs, memory, run logs, event receipts, metrics, documents, artifacts, or sprint history.
- Full development `scripts/lib`, hooks, provider adapters, and internal regression tests.

## [0.12.0-rc.1] - 2026-05-30

### Added

- Public starter README covering philosophy, architecture, install paths, core skills, issue-driven workflow, verification layers, parallel worker method, memory model, and release boundaries.
- Sanitized starter packaging boundary through `starter-manifest.yaml`.
- Public bootstrap state under `starter/.ai-os/`.
- Public skill and command setup surfaces under `starter/.claude/`.

### Changed

- Starter install commands now point at the public POKit2 repository.
- Starter archive naming now uses the release-candidate version.
- Changelog content is sanitized for public distribution.

### Not Included

- Real user-created issues, specs, sprint memory, run logs, event receipts, metrics, or local handoff state.
- Private development repository links.
- Personal paths, local runtime settings, secrets, package registry publishing, or hosted service claims.

## [0.11.0] - 2026-05-29

### Added

- Issue-driven local harness basics.
- Starter runner and doctor entrypoints.
- Bootstrap `.ai-os` structure.

### Not Included

- Package registry publishing.
- Hosted service launch.
- Private development work history.
