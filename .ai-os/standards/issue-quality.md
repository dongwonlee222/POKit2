# Issue Card Quality Standard

Definition readiness is governed by `.ai-os/standards/definition-readiness.md`.
This file defines card shape and AC quality; definition-readiness defines when a card is ready for implementation.

## Section Requirements by Issue Type

### spec / implementation

Required: Brief, Evidence, Acceptance Criteria, Development Plan, Test Plan, Worker Tasks or Subagent Plan, QA, Gate, Memory

Optional (add only when applicable):
- `## PO Summary` — spec or decision-heavy issue that needs PO review before implementation
- `## User Stories` — issue_type=spec with user-facing behavior
- `## Functional Requirements` — release-critical or contractual traceability needed
- `## Success Criteria` — measurable outcome metrics needed
- `## Clarifications` — after running /pokit.clarify
- `## Acceptance Scenarios` — user-facing behavior with edge cases
- `## Implementation Brief` — when Development Plan alone is insufficient for subagent accuracy

### hotfix / cleanup / release

Required: Brief, Evidence, Acceptance Criteria, QA, Gate, Memory

Lean rules:
- cleanup: max 2 AC, no Subagent Plan required
- release: max 3 AC, read-only subagent only
- No User Stories, FR/SC IDs, or GWT unless explicitly needed

## Acceptance Criteria Standard

Each AC must:
1. Be independently verifiable — not require another AC to pass first
2. State the measurable outcome, not the action
3. Contain no `[NEEDS CLARIFICATION:]` markers at gate time

Format guidance:
- Weak: "동기화 기능을 구현한다"
- Strong: "`syncTemplates({root, dryRun})`가 TARGETS 2개를 `.claude/commands/`에 복사하고 `{synced, errors}`를 반환한다"

## PO Summary

Use `## PO Summary` when the PO should decide from the card without reading every implementation detail.

Required five-line schema:

- **왜 하는가**
- **끝나면 뭐가 달라지는가**
- **PO가 확인할 것**
- **위험**
- **다음 행동**

The summary is a decision surface only. It does not replace Acceptance Criteria, QA, or Gate evidence.

## [NEEDS CLARIFICATION:] Marker

Use inline when a scope boundary or requirement is undecided at writing time.

Syntax: `[NEEDS CLARIFICATION: <question>]`

Example:
```
syncTemplates는 기존 파일을 덮어써야 하는가? [NEEDS CLARIFICATION: overwrite vs skip policy]
```

Rules:
- All markers must be resolved before gate_passed
- Run `/pokit.clarify` to resolve markers systematically
- Resolved markers move to `## Clarifications` table

## Functional Requirements (FR-001)

Use when:
- Issue has user-facing behavior requiring traceability
- Issue is release-critical or contractual

Format: `FR-001: System MUST <action> when <condition>.`

Skip for: cleanup, refactor, state-update, internal tooling issues.

## Success Criteria (SC-001)

Use when a measurable metric can serve as gate evidence.

Format: `SC-001: <metric> <operator> <threshold> (measured by: <method>)`

## User Stories

Use when issue_type is spec/implementation and a person performs an action.

Format: `As a <role>, I want to <action>, so that <outcome>.`
Priority labels: P1 (must), P2 (should), P3 (nice to have)

Skip for: cleanup, release, state-update, hotfix, infrastructure-only issues.

## Acceptance Scenarios (Given/When/Then)

Use when AC alone does not capture edge cases for user-facing behavior.

Format:
```text
Scenario: <name>
Given: <precondition>
When: <action>
Then: <expected outcome>
```

## Backlog Issue Item Fields

Newly authored backlog issues should preserve the issue graph contract from `/pokit.backlog`.

Required for ready/executable issues:

```yaml
goal: "<observable goal>"
work_type: prd | product_spec | roadmap | prototype | analysis | development | qa | ops | research | planning | decision
artifact_type: prd | spec | roadmap | prototype | analysis_memo | qa_plan | code_change | release_note | decision_log
produces:
  - <artifact-or-change>
consumes:
  - <input-or-prior-artifact>
depends_on: []
recommended_order: 1
graph_root: POK-XXX
sprint_candidate: <sprint-or-null>
definition_readiness: draft | pass
parallel_candidates: []
integration_issue_needed: false
conflict_scope:
  files: []
  artifacts: []
```

`issue_type` remains the execution enum: `spec`, `implementation`, `hotfix`, `cleanup`, `release`.
Do not use `issue_type` to describe PO artifact nature. Use `work_type` and `artifact_type`.

For `definition_readiness: draft`, `goal`, `produces`, and `consumes` are still expected so the draft can be reviewed without guessing.

## Child Issues and Worker Tasks

Issue graph terms:

- Child Issue: independent issue with its own gate, history, artifact contract, evidence, and memory.
- Worker Task: in-issue subagent dispatch unit executed under one parent issue.
- Sprint: issue graph subset selected for one execution window toward the same goal.

Use child issues when the work needs independent approval, history, artifact ownership, or gate evidence.
Use worker tasks when the work is a bounded execution slice inside one issue.

### Worker Tasks

> Note: `worker_type` (execution unit) is distinct from the issue frontmatter `agent_profile` (POK role: planner/coder/reviewer). Do not confuse the two.

Worker tasks are the preferred decomposition surface for subagent dispatch inside one issue.

### Decomposition required (any 1 condition triggers)

1. **AC count**: `## Acceptance Criteria` contains 5 or more AC lines.
2. **Change size**: expected or actual `changed_lines` is 300 or more.
3. **Worker diversity**: the issue declares 2 or more distinct `worker_type` values.

When decomposition is required, the issue card must include one of:

- A `## Worker Tasks` section with fenced YAML worker task declarations.
- Frontmatter opt-out:

```yaml
worker_tasks: not_required
worker_tasks_skip_reason: "single-file invariant update"
```

Compatibility:

- Legacy `## Sub-issues` and `sub_issues: not_required` remain accepted only as old aliases.
- New issues should not introduce `Sub-issues` for in-issue subagent work.
- If the work needs separate gate/history/artifact, create child issues in the issue graph instead of worker tasks.

Doctor fails or warns according to active guard policy when a required declaration is missing.

### Decomposition normally skipped (must still explain if a trigger matched)

- AC count <= 2.
- All ACs modify the same file.
- Issue type is `hotfix` or `cleanup`.

### YAML format

Each worker task is declared inside a fenced YAML block under `## Worker Tasks`:

```yaml
- id: POK-XXX-W1
  title: "Concise task title"
  worker_type: docs_worker
  purpose: "Bounded reason for dispatch"
  allowed_paths:
    - .ai-os/standards/issue-quality.md
  inputs:
    - issue_card
  expected_output:
    - "Description of the artifact or change produced"
  constraints:
    - "No global state edits"
  verification:
    - "Relevant contract tokens exist"
  depends_on: []
  handoff_prompt: |
    You are implementing POK-XXX-W1 in /path/to/repo. Read <files>. <scope>.
    Do not alter global state, gate, metrics, git staging, commit, or push.
    Return a diff summary, tests run, and unresolved risks.
```

Required fields: `id`, `worker_type`, `purpose`, `allowed_paths`, `inputs`, `expected_output`, `constraints`, `verification`, `depends_on`.
Optional fields: `title`, `handoff_prompt`.

### `handoff_prompt` field

`handoff_prompt` is a copy-pasteable, self-contained prompt for an external agent or sub-session delegate.
It must name:

- the repo path,
- the files to read,
- the bounded scope, and
- what to return.

A delegate receiving only the `handoff_prompt` must need no chat context to begin work.

`handoff_prompt` is **optional per task** but recommended for any independently-delegable slice. When present it must not instruct the worker to alter global state, update gate evidence, record metrics, or run `git commit`/`git push`. Those responsibilities remain with the main/orchestrator session.

### Single-session opt-out

Single-session execution is always valid. When an issue meets a decomposition trigger (AC count ≥ 5, `changed_lines` ≥ 300, or 2+ distinct `worker_type` values) but no Worker Tasks are needed, the issue must provide an **explicit opt-out reason** using one of:

- Frontmatter opt-out with reason:

```yaml
worker_tasks: not_required
worker_tasks_skip_reason: "<reason why single-session is appropriate>"
```

- An explicit skip note in the `## Worker Tasks` section body (when YAML block is absent).

Omitting the opt-out reason when a trigger condition is met is a doctor fail. The `worker_tasks_skip_reason` value must be a non-empty, human-readable explanation — not a placeholder.

### `allowed_paths` rules

- List exact file paths only. No globs (`*`, `**`). No directory prefixes.
- Correct: `.ai-os/standards/issue-quality.md`
- Wrong: `.ai-os/standards/`, `scripts/**/*.mjs`
- A file must not appear in two simultaneously dispatched worker tasks' `allowed_paths`.

Valid `worker_type` values: `docs_worker`, `spec_worker`, `code_worker`, `cleanup_worker`, `review_worker`, `qa_worker`.

### to-do checklists

Write one Markdown checklist per worker task **outside** the YAML block, immediately after it:

```markdown
**POK-XXX-W1 to-do**
- [ ] Step one
- [ ] Step two
```

Use `**POK-XXX-WN to-do**` as the label and `- [ ]` for each item.

### Compatibility: Deprecated Sub-issues

> Note: `worker_type` (execution unit) is distinct from the issue frontmatter `agent_profile` (POK role: planner/coder/reviewer). Do not confuse the two.

Old `Sub-issues` terminology mixed two concepts:

- child issue: independent issue graph node
- worker task: subagent dispatch unit inside one issue

For old cards, `## Sub-issues` may be interpreted as `## Worker Tasks` only when the entries describe bounded worker dispatch and do not need independent gate/history/artifact.
For new cards, prefer `## Worker Tasks` for dispatch or child issues for graph decomposition.

### Reference

For the old heavyweight sub-issue contract (separate `.md` files, backlog index, cross-issue dependencies), see `POK-082 sub-issue-contract.md`.
For new Backlog Flow issue graphs, prefer child issues with `graph_root`, `depends_on`, and `recommended_order`.

## Implementation Brief

Add as a subsection of Development Plan (or as `## Implementation Brief`) when:
- issue_type is implementation or hotfix
- A subagent needs file-level context to execute accurately

Required content:
- Relevant files and their current role
- Patterns to follow (reference existing code by path)
- Explicit non-scope: what NOT to touch
- Expected output format or interface

## Clarify Auto-Suggest Rule

After `/pokit.issue` outputs a draft, suggest `/pokit.clarify` if ANY condition is true:
- issue_type is spec/implementation AND any AC contains: "적절히", "필요에 따라", "등", "어느 정도", "충분히"
- Any AC has a `[NEEDS CLARIFICATION:]` marker
- AC count ≥ 5 and any AC is not independently verifiable

Suggestion format: "AC #N이 모호합니다. `/pokit.clarify`로 명확화를 권장합니다."
