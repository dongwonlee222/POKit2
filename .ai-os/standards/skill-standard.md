# Skill Standard

POKit2 스킬의 형식, 언어, Gate 검증 표준. 내부 runner 스킬과 외부 스킬 두 종류를 다룬다.

## Cross-runtime Issue Workflow Contract

`pokit-issue` is an issue workflow engine, not a code-only automation. It covers docs/spec/standard work, implementation and hotfix work, cleanup/deletion work, and release/readiness gates when a Harness Issue defines the scope.

Runtime support is valid only when all three parts are proven for that runtime:

| Runtime | Discovery | Trigger | Execution |
|---|---|---|---|
| Claude | Runtime can discover the skill in its skill list. | The documented trigger invokes `pokit-issue`. | The issue workflow reaches the intended guarded step. |
| Codex | Runtime can discover a Codex-loaded skill or shim. | The documented trigger invokes the Codex path. | The issue workflow reaches the intended guarded step. |
| Antigravity | Runtime can discover an Antigravity entrypoint or shim. | The documented trigger invokes the Antigravity path. | The issue workflow reaches the intended guarded step. |

Structural proof and runtime proof are separate. A valid `.claude/skills/pokit-issue/SKILL.md` file proves Claude internal skill structure only; it does not prove Codex or Antigravity discovery, trigger, or execution.

Runtime execution proof must distinguish main orchestration proof from worker execution proof; main-session context/gate/state handling alone does not prove worker work ran.

User-facing lifecycle cards and system-facing execution evidence are separate surfaces. The visible card text should use PO-facing Korean labels and next-action language; workflow tokens such as `Workers:`, `Fallback reason:`, `metrics.json`, and `LLM-response-only` remain in issue traces, metrics, tests, and contract sections where hooks/doctor can inspect them.

Current runtime proof state:

- `runtime_proof.claude`: warning until fresh Claude discovery, trigger, and execution evidence is recorded.
- `runtime_proof.codex`: warning until Codex discovery, trigger, and execution are implemented and proven.
- `runtime_proof.antigravity`: warning until Antigravity discovery, trigger, and execution are implemented and proven.

Codex user setup:

1. Install a Codex-facing `pokit-issue` skill at `$CODEX_HOME/skills/pokit-issue/SKILL.md`, or `~/.codex/skills/pokit-issue/SKILL.md` when `CODEX_HOME` is unset.
2. Restart Codex or open a fresh `codex exec` session.
3. Verify the skill appears in the available skills list.
4. Verify a trigger phrase such as `POK-100 시작` selects `pokit-issue`.

This setup proves Codex discovery only after a fresh session observes the skill. Trigger and execution proof must still be recorded separately when a gate depends on full Codex runtime support.

### Codex Installed Skill Sync Contract (POK-165)

The repo skill and installed Codex skill must not drift on critical workflow tokens. The canonical source remains `.claude/skills/pokit-issue/SKILL.md`; the Codex-installed copy is a runtime adapter surface, not a separate contract.

Codex installed skill path resolution:

1. `$CODEX_HOME/skills/pokit-issue/SKILL.md` when `CODEX_HOME` is set.
2. `~/.codex/skills/pokit-issue/SKILL.md` when `CODEX_HOME` is unset.

Critical sync tokens:

```text
needs_subagent_authorization
b) 자동
Workflow Trace
Workers:
Fallback reason:
worker-unavailable
metrics.json
Hook Enforcement Matrix
authoring_path
authoring_contract_version
LLM-response-only
```

Gate policy:

- If the installed Codex skill is absent, record `runtime_proof.codex: warning` unless the issue explicitly requires Codex runtime support; then fail the gate.
- If the installed Codex skill exists but misses any critical sync token, report installed skill drift.
- If a fresh Codex session cannot see the installed skill, structural sync is insufficient; keep `runtime_proof.codex` as warning/fail according to the issue gate.
- Updating `.claude/skills/pokit-issue/SKILL.md` alone never proves Codex runtime behavior.

POK-097 measurement/events must hook conceptually at workflow start, mode selection, implementation start/end, verification end, gate update, and commit proposal. POK-105 defines these emit points only; metrics storage belongs to POK-097.

## Issue Authoring Checklist

Before authoring or executing an issue through `pokit-issue`:

1. Run the `artifact-standard.md` STEP 0 over-design check.
2. Confirm Harness Spec §7.2 preflight: active issue exists, the issue file exists, state is accepted/scoped or explicitly approved, work maps to Acceptance Criteria, and release-scope exceptions have human approval.
3. Confirm Harness Spec §7.4 body structure for the issue type.
4. For docs/spec/code/cleanup/review/QA work, include a task-type Worker Plan with owned files and expected proof.
5. Use `not required — <reason>` only for global-state-only or worker-tool-unavailable cases, and record the main-only boundary.
6. Check `pokit_identity` with evidence, not self-claim: local-first, public-first, `.ai-os` source of truth, PO natural-language start/confirm path, and no private path/account/SaaS dependency.
7. Record issue authoring path evidence when creating or materially updating an issue:
   - `authoring_path: pokit.issue` for slash-command flow.
   - `authoring_path: natural-language-issue-authoring` for equivalent natural-language flow.
   - `authoring_contract_version: 0.1.0` until the template version changes.
   - Legacy cards may use `authoring_path: legacy` only with an explicit skip reason.
8. Check `/pokit.issue` path drift: `.ai-os/templates/commands/issue.md` and `.claude/commands/pokit.issue.md` must share `authoring_path`, `authoring_contract_version`, `Workflow Trace`, `Subagent Plan`, and `Implementation Brief` contract tokens.

## Skill Types

| Type | Location | Registration | Examples |
|---|---|---|---|
| Claude internal runner | `.claude/skills/<name>/SKILL.md` | Not in catalog | pokit-issue, pokit-view |
| Codex runtime skill | Codex-loaded skill path (`$CODEX_HOME/skills` or future generated `.codex` shim) | Not covered by `.claude/skills` checks | deferred |
| External | `~/.claude/skills/<name>/SKILL.md` | `.ai-os/skills/catalog.md` | grill-me, tdd, code-review |

External skill management rules: see `.ai-os/standards/skill-management.md`.

## Claude Internal Runner Skill Format

### Directory Structure (required)

```
.claude/skills/
  <name>/
    SKILL.md    ← required
```

Single flat `.claude/skills/<name>.md` files are invalid — doctor will warn.

### Required Frontmatter

```yaml
---
name: <kebab-case-name>
description: "<trigger rules + scope in English>"
---
```

Both `name` and `description` are required. Without them the skill is invisible to Claude — it will never be invoked automatically.

This does not make the skill visible to Codex. A fresh Codex runtime proof must show the skill in Codex's available skills list or demonstrate an actual Codex trigger path.

### Description Rules

`description` is the **only** mechanism by which Claude decides to invoke a skill. Follow these rules:

1. Write in English.
2. Be explicit about trigger conditions using `TRIGGER when:` and `SKIP:` labels.
3. Use "pushy" language — "Must use this skill when...", "do NOT proceed without this skill".
4. Keep under 1,536 characters (combined with `when_to_use` if used).

Example:
```yaml
description: |
  Executes a POKit2 issue workflow end-to-end (pre-check → implement → state update → verify → commit).
  TRIGGER when: user says "진행해줘", "그럽시다", or "시작합니다" AND active_issue exists in .ai-os/current.md AND gate_state is not gate_passed.
  Must use this skill — do NOT proceed with manual execution when trigger conditions are met.
  SKIP: general conversation, small edits, startup restore ("포킷 시작", "시작하자", "이어서 하자"), or gate_state is gate_passed.
```

## Workflow Routing Between pokit-next and pokit-issue

Progress phrases are state-dependent:

| Current `gate_state` | User phrase | Owner |
|---|---|---|
| `gate_passed` | "그럽시다", "진행해줘", "시작합니다", "해보자", "가자", "오케이 해줘" | `pokit-next` |
| `pending` / `in_progress` | "그럽시다", "진행해줘", "시작합니다" | `pokit-issue` |
| any | unrelated conversation | none |

When `pokit-next` transitions to a new issue, its output contract must include:

```yaml
next_owner: pokit.issue
new_gate_state: pending
```

After this handoff, the next progress input belongs to `pokit-issue` Step 1/2. Main sessions must not manually change `active_issue` and immediately start implementation outside the handoff path.

## Sprint Kickoff Scope-First Guard

New sprints start with a scope spec issue, not with an implementation/spec candidate selected from the prior sprint's forward list.

For v0.10.0 and later:

1. `.ai-os/sprints/<sprint>/release-scope.yaml` must include `scope_spec_issue: POK-XXX`.
2. The first `accepted:` entry must be that same scope spec issue.
3. The scope spec issue must be `issue_type: spec` and its title must include `<sprint> Scope Spec`.
4. No later sprint issue may become `active_issue` until the scope spec issue is `gate_passed`.
5. Hotfix/release repair exceptions require an explicit issue-card reason.

This prevents a released sprint handoff from jumping directly to a candidate such as POK-150 before the next sprint boundary is defined.

## Codex Subagent Authorization Bridge

For Codex, `pokit-issue` execution approval and worker subagent authorization must be explicit in the same user-facing flow.

| Input while `gate_state` is `pending` / `in_progress` | Meaning |
|---|---|
| `b` | Run automatically and authorize worker subagent fan-out within the active issue scope. |
| `자동` | Same as `b`. |
| `그럽시다`, `진행해줘`, `시작합니다` | Start the issue workflow and authorize worker subagent fan-out when Step 2 is reached. |
| review-only or general conversation | No subagent authorization. |

If authorization is missing, the workflow must stop as `needs_subagent_authorization`. This is distinct from `worker-unavailable`, which means authorization exists but the subagent tool failed, was unavailable, overloaded, or policy-blocked.

### Language Policy

| Content | Language |
|---|---|
| Frontmatter fields | English |
| Skill body (instructions) | English |
| User-facing output in skill | Korean (ko-KR) |

### Gate: runtime_proof Required

For any issue that creates or modifies a skill file, the Gate section must include `runtime_proof`:

```
- runtime_proof  Open a fresh Claude Code session and verify the skill appears
                 in the system-reminder skills list.
                 Example: "New session confirmed: pokit-issue listed in system-reminder ✅"
```

For Codex, valid proof is different:

```
- runtime_proof  Fresh codex exec/app session shows the skill in available skills, or the trigger actually invokes the Codex skill.
```

**Important**: Same-session verification is invalid — the agent may already have the file in context. Structural doctor output is useful, but it is not runtime proof.

## Doctor Checks

`pokit-doctor.mjs` runs `checkInternalSkills` which warns on:
- Single flat `.claude/skills/<name>.md` files (not directory structure)
- Missing `name:` frontmatter
- Missing `description:` frontmatter

## Deferred Issue Registration Rule

When an issue's Out of Scope lists "별도 이슈", that candidate must be registered as a real issue card (via `/pokit.backlog`) or in the active sprint's `release-scope.yaml` before gate_passed. Writing "별도 이슈" in a document without registering it causes scope loss across sessions. (`issue-index.md`는 POK-328로 동결 — 더 이상 등록처가 아니다.)
