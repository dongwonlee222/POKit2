# Runtime Proof Standard

POK-133 defines how POKit may claim runtime support for Claude, Codex, Antigravity, or a future provider.

검증 철학: proof는 많이 돌린 로그가 아니라, PO가 다음 세션에서 이어가도 되는지 판단할 수 있는 trust boundary별 최소 충분 증거다.

## Scope

Applies to:

- README runtime wording
- release notes and release checklists
- Harness Issue `Brief`, `Evidence`, `Gate`, and `Memory`
- provider setup docs that mention runtime support

Out of scope:

- provider adapter implementation
- installed skill sync enforcement implementation
- verification intensity runner logic
- retroactive proof backfill unless a later issue requires it

## Proof Levels

| Level | Meaning | Minimum Evidence | Claim Ceiling |
|---|---|---|---|
| `discovery` | runtime can find the entrypoint, skill, shim, or command surface | fresh runtime/session identifier; exact observed surface name; path/version/hash or command output; timestamp; evidence author | "discoverable" / "setup surface recognized" |
| `trigger` | documented user phrase or command reaches the intended runtime path | all discovery evidence; exact trigger input; expected handler name; observed route/selection output; timestamp | "trigger verified" |
| `execution` | triggered path reaches the guarded workflow step and produces reproducible workflow evidence | all trigger evidence; issue id; workflow step reached; command/tool output or lifecycle card; Worker/Fallback/Authorization evidence when relevant; metrics or explicit skip reason; timestamp | "runtime support verified for this workflow scope" |

Rules:

- Higher levels include lower-level evidence.
- One provider's proof never transfers to another provider.
- Structural file existence, doctor pass, or same-session memory is not runtime proof.
- Main orchestration proof and worker execution proof are separate. If worker fan-out is claimed, evidence must include worker or fallback details.
- This standard is the SSoT for runtime support claim levels; structural existence or authorization is not runtime execution proof. The full claim-boundary ownership map is in `claim-boundary-ssot-map.md`.

## Evidence Schema

Each provider proof artifact uses this minimum shape:

```yaml
provider: codex | claude | antigravity | <future-provider>
proof_level: discovery | trigger | execution
status: pass | warning | fail | deferred
verified_at: YYYY-MM-DD
fresh_session: true | false
runtime_version: <string-or-unknown>
entrypoint_path: <path-or-command>
trigger_input: <string-or-none>
observed_output: <short-summary>
workflow_scope:
  issue_id: POK-XXX | none
  workflow_step: <step-or-none>
  workers: <list-or-none>
  fallback_reason: <enum-or-none>
evidence:
  commands:
    - <exact command/tool invocation>
  files:
    - <path>
  notes:
    - <short note>
residual_risk: <short note>
```

`fresh_session: false` may document a diagnostic observation, but it cannot raise support level.

## Proof Artifact Path

Decision: provider runtime proof artifacts live under:

```text
.ai-os/runtime-proof/<provider>.md
```

Rationale:

- `.ai-os` is the source of truth for gate evidence and runtime state.
- Runtime proof can include local paths, command outputs, and session-specific evidence that should not automatically become public docs.
- Public `docs/runtime/<provider>.md` may explain setup and may link or summarize proof state, but it is not the canonical proof artifact.

Path rules:

- One canonical provider file per runtime: `.ai-os/runtime-proof/codex.md`, `.ai-os/runtime-proof/claude.md`, `.ai-os/runtime-proof/antigravity.md`.
- If proof is workflow-specific, add a dated section inside the provider file; do not create ad hoc scattered proof files.
- Release-facing docs may say "see runtime proof artifact" only after the corresponding `.ai-os/runtime-proof/<provider>.md` exists and records the level being claimed.

## Claim Wording

Allowed README wording:

| Proof Level | Allowed |
|---|---|
| none | "POKit includes repo entrypoints for <provider>." |
| `discovery` | "<provider> discovery has been verified in a fresh session." |
| `trigger` | "<provider> trigger routing has been verified for the documented startup/issue phrase." |
| `execution` | "<provider> runtime support is verified for <workflow scope>." |

Forbidden README wording without `execution` proof:

- "<provider> is supported"
- "works in <provider>"
- "fully compatible with <provider>"
- "production-ready <provider> runtime"
- "Codex/Claude/Antigravity all support the same workflow"

Allowed release wording:

| Proof Level | Allowed |
|---|---|
| none | "Runtime support remains unverified for <provider>." |
| `discovery` | "Release includes discovery proof for <provider>; trigger/execution remain pending." |
| `trigger` | "Release includes trigger proof for <provider>; execution remains pending." |
| `execution` | "Release includes execution proof for <provider> on <issue/workflow>." |

Forbidden release wording:

- "released with <provider> support" unless execution proof exists
- "multi-runtime release" unless every named runtime has execution proof for the claimed workflow
- "verified" without naming level, provider, evidence path, and date

Allowed issue wording:

| Proof Level | Allowed |
|---|---|
| none | "Target runtime proof: pending." |
| `discovery` | "Runtime proof: discovery pass, trigger/execution pending." |
| `trigger` | "Runtime proof: trigger pass, execution pending." |
| `execution` | "Runtime proof: execution pass for this issue scope." |

Forbidden issue wording:

- `gate_passed` based only on worker/subagent output
- `runtime_proof` based only on file existence or same-session observation
- support claims that omit provider name

## Boundary With POK-105

POK-105 owns the cross-runtime workflow contract:

- Discovery / Trigger / Execution 3-tuple
- separation of structural proof and runtime proof
- issue workflow as cross-runtime engine
- conceptual runtime proof warning keys

POK-133 does not redefine the workflow contract. It defines the claim vocabulary, minimum evidence, canonical artifact path, and proof checklist used when applying POK-105.

## Boundary With POK-165

POK-165 owns Codex installed skill sync and hook-backed workflow trace enforcement:

- installed Codex skill drift detection
- `/pokit.issue` authoring path drift detection
- v0.10+ Workflow Trace and metrics enforcement
- worker/fallback evidence enforcement

POK-133 does not implement those guards. It says which runtime support claims require proof and proposes the minimal guard shape below.

## Guard Proposal

Guard name: `runtime_claim_without_proof`

Class: doctor/test proposal only for POK-133.

Trigger:

- README, release docs, or issue files add or modify runtime support wording for `Claude`, `Codex`, `Antigravity`, or a configured future provider.
- Wording uses claim verbs such as `support`, `supported`, `works`, `compatible`, `verified`, `runtime support`, or Korean equivalents such as `지원`, `동작`, `검증`.

Required pass condition:

- The changed claim names a provider.
- The changed claim names a proof level.
- `.ai-os/runtime-proof/<provider>.md` exists.
- The artifact records proof level equal to or higher than the claim.
- The artifact has `fresh_session: true` for any `discovery`, `trigger`, or `execution` upgrade.

Suggested severity:

| Case | Severity |
|---|---|
| public README/release overclaims execution support | fail |
| issue evidence overclaims execution support | fail |
| setup docs mention discovery without artifact | warning |
| explicit deferred/pending wording | pass |

## Reusable Checklist

Use this checklist for POK-130, POK-160, POK-159, POK-161, and future provider runtime issues.

```markdown
## Runtime Proof Checklist

- [ ] Provider named exactly: `<provider>`
- [ ] Target proof level selected: `discovery` / `trigger` / `execution`
- [ ] Canonical artifact path: `.ai-os/runtime-proof/<provider>.md`
- [ ] Fresh session used; same-session context not counted
- [ ] Entrypoint or installed surface path recorded
- [ ] Runtime version or "unknown" recorded
- [ ] Discovery evidence recorded
- [ ] Trigger input and observed route recorded, or marked pending
- [ ] Execution workflow step recorded, or marked pending
- [ ] Worker/Fallback/Authorization evidence recorded when worker execution is claimed
- [ ] README wording stays at or below proven level
- [ ] Release wording stays at or below proven level
- [ ] Issue Gate wording stays at or below proven level
- [ ] POK-105 workflow contract not redefined
- [ ] POK-165 installed skill sync boundary not reimplemented
- [ ] Guard implementation, if any, is handled by a separate code issue
```

Provider mapping:

| Issue | Expected Use |
|---|---|
| POK-130 | apply checklist to runtime claim cleanup or proof debt inventory |
| POK-160 | apply checklist to Codex runtime proof |
| POK-159 | apply checklist to Claude runtime proof |
| POK-161 | apply checklist to Antigravity runtime proof |

## Claim Decision Tree

```text
Need to say runtime works?
  |
  +-- no provider named -> do not claim support
  |
  +-- provider artifact missing -> use pending/deferred wording only
  |
  +-- discovery only -> say discoverable only
  |
  +-- trigger only -> say trigger verified only
  |
  +-- execution proof exists -> claim support only for the proven workflow scope
```

