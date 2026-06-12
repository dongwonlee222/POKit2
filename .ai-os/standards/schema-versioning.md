# Schema Versioning Standard

Schema versioning in POKit2 uses a surface-specific custom rule, not strict SemVer. Each file surface owns its `schema_version` independently. Bump rules are defined by impact on doctor validation and workflow contracts.

## Versioning Rule

POKit2 uses MAJOR.MINOR.PATCH format with these trigger definitions:

| Level | Trigger | Example |
|-------|---------|---------|
| MAJOR | Required field removed, renamed, or semantics changed; status enum value removed; workflow transition rule changed | Remove `canonical_state` from POK frontmatter |
| MINOR | Optional field added that doctor now validates; enum value added; field meaning extended (existing values still valid) | Add `depends_on` optional field with doctor check (POK-038) |
| PATCH | Field description clarified; soft constraint added; doctor message improved; no data or validation impact | Clarify `goal` field format note |

**Rule**: Bump only when a doctor or runner reads the field. If no tooling reads it, it is a PATCH at most.

## Per-Surface Responsibility

### POK Frontmatter (`.ai-os/POK-XXX.md` and future `projects/<project>/issues/POK-XXX.md`)

- Current version: `0.1.0`
- Owner: main agent, on POK contract change issues
- Scope: required/optional fields, status enum, gate flow
- Bump trigger: MINOR when a new optional field is added and doctor validates it; MAJOR when a required field is removed or the status enum contracts

### `release-scope.yaml`

- Current version: `0.1.0`
- Owner: main agent, on sprint-scope contract change issues
- Scope: sprint identifier, issue membership list, candidate/accepted status
- Bump trigger: MINOR when new sprint attributes are added; MAJOR when issue membership schema changes in a breaking way

### `current.md` (runtime pointer)

- Current version: `0.1.0`
- Owner: main agent, updated each session
- Scope: `active_project`, `active_issue`, `gate_state`, `next_action`, `active_sprint`
- Bump trigger: MINOR when new required pointer fields are added; MAJOR when existing pointer fields are removed or renamed

### `pokit.config.yaml`

- Current version: `0.2.0`
- Owner: release packaging issues
- Scope: starter/contract/schema versions, compatibility policy, update policy
- Note: `pokit.config.yaml` carries both its own file-structure `schema_version` and `pokit_version.schema_version` (the declared runtime schema). Both follow this standard.

## minimum_supported_schema

`pokit.config.yaml` declares `minimum_supported_schema`. Compatibility rules:

- File `schema_version >= minimum_supported_schema` → supported, no warning
- File `schema_version < minimum_supported_schema` → doctor emits `warn` (governed by `on_schema_mismatch: warn` in `pokit.config.yaml`)
- `minimum_supported_schema` may only be bumped in an explicit release packaging issue, not in spec or implementation issues

Current baseline: `schema_version: 0.2.0`, `minimum_supported_schema: 0.1.0`. All existing `0.1.0` POK files are supported.

## Relation to optional-fields (POK-038)

Schema versioning and optional-fields are orthogonal concerns:

- `schema_version` protects **file structure** — which fields exist and how they are typed.
- Optional-fields contract (POK-038) validates **field values** — `depends_on` chain format, `agent_profile` enum membership.
- Adding a new optional field triggers a MINOR schema bump only when doctor begins validating that field's value.
- Optional fields that are present but not yet validated by doctor do not require a schema bump.

## POK-066 Physical Migration Decision

**Decision: `schema_version` stays at `0.1.0`. No bump required for POK-066.**

Physical migration (`.ai-os/POK-XXX.md` → `projects/pokit/issues/POK-XXX.md`) changes the file path only. Frontmatter fields, required/optional field sets, and status enum remain identical. A schema bump would be required only if:

- New required fields are added to issue files as part of migration.
- The file path itself becomes a validated frontmatter field.

Neither applies in POK-066 scope. Migrated files retain `schema_version: 0.1.0`.

## Doctor and Test Verification

`scripts/pokit-doctor.mjs` validates `schema_version` as a required field on:

- POK frontmatter files
- `current.md`
- `pokit.config.yaml`

Schema compatibility check: if `schema_version < minimum_supported_schema`, doctor emits `warn` per `on_schema_mismatch` policy. No new doctor enforcement is added by this standard. Tooling changes belong to a dedicated implementation issue.

Tests that reference `schema_version` values must read the live value from `pokit.config.yaml` or the active issue file rather than hardcoding `0.1.0`. See `.ai-os/standards/test-standard.md` for the dynamic-read pattern.
