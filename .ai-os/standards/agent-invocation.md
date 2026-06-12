# Agent Invocation Standard

- Main session is the context manager and conductor.
- Main session is also named `main_orchestrator` in the v0.14 role model (`docs/v0.14.0/orchestration-role-model.md`); the two names are the same role — owner of scope, worker dispatch, integration, gate evidence, and final judgment.
- Main session owns context, scope, worker dispatch, integration, gate evidence, state updates, approval boundary, and final judgment.
- Main session must not directly perform durable docs, code, cleanup, or QA work except for narrow emergency fixes or when no worker tool is available.
- Worker subagents are the default executors for durable work when the current runtime exposes a callable worker tool and the issue records execution evidence.
- L0 does not use subagents.
- L1 allows read-only subagent analysis only.
- L2 and later attempt parallel worker dispatch by default when independent work slices exist; if no supported runtime path is available, record the narrow fallback instead of claiming execution.
- L2 and later may use write-scoped fan-out after gate and memory checks exist.
- Subagent output is input evidence, not completion proof.
- Subagents cannot claim done, update global state, or approve external writes.
- Cross-session thread or worktree output follows the same evidence rule: it is
  input to the main session/integrator, not completion proof.
- This standard is the SSoT for the worker-output and authorization boundary
  (`authorized_phrases` below is the synonym SSoT). The full claim-boundary
  ownership map is in `claim-boundary-ssot-map.md`.

```yaml
execution_contract:
  main_session:
    role: context_manager_conductor
    aka: main_orchestrator   # v0.14 role model name (docs/v0.14.0/orchestration-role-model.md)
    owns:
      - context
      - scope
      - worker_dispatch
      - integration
      - gate_evidence
      - state_updates
      - approval_boundary
      - final_judgment
    durable_work_policy:
      default: dispatch_to_worker_subagents_when_runtime_evidence_is_available
      direct_main_session_work_allowed_only_when:
        - narrow_emergency_fix
        - no_worker_tool_available
    may_not_directly_execute_by_default:
      - durable_docs
      - durable_code
      - cleanup
      - qa
  worker_subagents:
    role: work_executors
    execute:
      - bounded_docs
      - bounded_code
      - bounded_cleanup
      - bounded_qa
    cannot:
      - claim_done
      - update_global_state
      - approve_external_write
  dispatch:
    L0: none
    L1: read_only_analysis
    L2_plus:
      default: parallel_workers_for_independent_slices
      permission: write_scoped_after_gate_and_memory_checks
```

## Permission Levels

```yaml
agent_permission_levels:
  read_only:
    can_read: allowed_context
    can_write: none
    allowed_from: L1

  write_scoped:
    can_read: allowed_context
    can_write: allowed_files_only
    allowed_from: L2
    forbidden:
      - global_state_edit
      - final_done_claim

  propose_only:
    can_read: allowed_context
    can_write: proposed_update_files_only
    can_apply: false
    allowed_from: L3

  main_only:
    can_update_global_state: true
    can_claim_done: true
    can_approve_external_write: true
```

## Main-only Global Files

- `.ai-os/current.md`
- `.ai-os/status-board.md`
- `.ai-os/issue-index.md`
- `.ai-os/memory/session/handoff.md`
- `.ai-os/memory-index.md`
- `.ai-os/failure-index.md`
- `.ai-os/sprints/*/release-scope.yaml`
- issue card lifecycle/gate frontmatter
- `.ai-os/runs/*/metrics.json`

## Cross-Session Integration

Session-internal Worker Tasks run under a live main-session conductor. Separate
threads and git worktrees do not share that live conductor boundary, so their
durable output returns through an integration gate.

Rules:

- The merge owner is the main session/integrator.
- Spawned sessions may produce commits, proposed updates, research notes, and
  verification notes, but they do not update main-only global files.
- The integrator inspects the diff, checks the assigned scope, resolves merge
  conflicts, reruns or accepts verification evidence, and then writes state,
  metrics, commits, and gate evidence.
- Runtime paths are runtime-specific. `.claude/worktrees/` is a Claude-specific
  example, not a universal location for Codex or other runtimes.
- Cleanup happens after the merge/push/keep decision. Do not delete a worktree
  or close the spawned session while useful uncommitted, unmerged, or unpushed
  work may be stranded.

## Runtime Safety

## Worker Task Contract

Worker Task는 한 issue 내부의 subagent dispatch 단위다.
독립 gate/history/artifact가 필요한 작업은 Worker Task가 아니라 child issue로 분리한다.

Required worker task fields:

```yaml
worker_tasks:
  - id: POK-XXX-W1
    worker_type: docs_worker
    purpose: "<bounded task>"
    allowed_paths:
      - <exact path>
    inputs:
      - issue_card
    expected_output:
      - <artifact-or-finding>
    constraints:
      - "No global state edits"
    verification:
      - <check>
    depends_on: []
```

Rules:

- Main session owns worker dispatch, integration, verification, metrics, gate evidence, and final judgment.
- Worker output is input evidence, not completion proof.
- Workers cannot call other workers. Nested subagent dispatch is forbidden.
- Worker tasks may run in parallel only when `allowed_paths` and artifact ownership do not conflict.
- If worker tasks exist, `/pokit.issue` Step 5 must dispatch matching workers or record a narrow fallback in `## Workflow Trace`.
- Legacy `Sub-issues` can be treated as Worker Tasks only for old cards where entries describe in-issue dispatch. New issue graph decomposition uses child issues.

Worker types:

```text
docs_worker
spec_worker
code_worker
cleanup_worker
review_worker
qa_worker
```

### Worker model-tier defaults

Worker Task를 dispatch할 때 모델 티어는 아래 우선순위로 결정된다:

```
Worker Task 명시 model_tier override
  > worker_type default tier (아래 결정표)
    > agent_profile fallback (assignment-model-tiers.mjs)
```

**worker_type별 default tier 결정표:**

| worker_type | default tier | 이유 |
|---|---|---|
| docs_worker | fast | 단순 문서 작성, 속도·비용 우선 |
| spec_worker | strong | 설계 추론 필요, 정확성 중요 |
| code_worker | standard | 균형 (속도 + 정확성) |
| cleanup_worker | fast | 기계적 정리 작업 |
| review_worker | strong | 정밀 검토, 오류 탐지 중요 |
| qa_worker | standard | 검증 작업, 균형 |

**research_worker 신설 여부 결정:** 현재 표준에 없음. 리서치 성격 작업은 `spec_worker`(strong)로 처리한다. 독립 타입 신설은 실사용 사례 축적 후 재검토.

**Worker Task model_tier 오버라이드 필드:**

```yaml
worker_tasks:
  - id: POK-XXX-W1
    worker_type: docs_worker
    model_tier: strong        # 옵셔널. 미지정 시 위 결정표 default 사용.
    purpose: "<bounded task>"
```

허용 enum: `fast | standard | strong | max` (이 파일 Payload Contract와 동일 SSoT).

**fast 명시 시 fallback 정책:**

위로만-fallback 불변식 준수. fast(haiku급) 실패 시 → standard로만 올림. haiku 다운그레이드는 금지.

```yaml
model_tier_fallback:
  direction: up_only          # fast → standard → strong → max
  down_forbidden: true        # haiku 다운그레이드 금지
  explicit_fast_failure: escalate_to_standard
```

**런타임별 적용 범위:**

- Claude Code: 위 결정표 및 우선순위 전면 적용.
- Codex / Antigravity: worker fan-out 미증명 런타임. `model_tier` 필드는 no-op으로 처리(무시). runtime-capability-matrix.md 업그레이드 후 확장.

**후속 구현 이슈 conflict_scope:**

이 결정을 코드에 반영하는 구현 이슈는 아래 파일을 수정해야 한다:

```yaml
conflict_scope:
  files:
    - scripts/lib/assignment-model-tiers.mjs   # worker_type 매핑 테이블 신설 또는 agent_profile 매핑 공존
    - scripts/lib/sub-issue-schema.mjs          # model_tier 옵셔널 필드 + enum 검증 추가
    - .ai-os/standards/agent-invocation.md      # 이 섹션 (이미 반영)
```

`assignment-model-tiers.mjs` 변경 방식: agent_profile 기반 매핑(현재)을 유지하면서 worker_type 기반 매핑 테이블을 신설해 공존시킨다. worker_type 매핑이 존재하면 우선 적용, 없으면 agent_profile fallback. 기존 planner/coder/reviewer 키 제거 금지(backward-compat).

### Codex Subagent Authorization Bridge

Codex requires explicit user permission before worker subagents may be spawned. In a pending or in-progress `pokit-issue` workflow, the following approvals count as subagent authorization:

- `b`
- `자동`
- `그럽시다`
- `진행해줘`
- `시작합니다`
- `진행합시다`
- `진행하자`
- `진행하자고`
- `진행시켜`
- `가자`
- `고`
- `고고`
- `해보자`
- `해보자고`
- `오케이 해줘`

This list is the single source of truth (SSoT) for execution-approval synonyms. The runner (`scripts/pokit-runner.mjs`), `pokit-issue`, and `pokit-next` must stay synchronized with it; do not add an execution-approval synonym in only one place. Runner matching may normalize internal whitespace for these phrases, but it must still require a whole-input match.

Authorization scope is limited to the active issue, its declared allowed files, and the worker roles described by the issue workflow. General conversation, review-only questions, or review-intent phrases such as "확인해줘", "검토해줘", "봐줘" do not authorize subagent fan-out.

If authorization is missing, the workflow state is `needs_subagent_authorization`. The main session must ask for explicit approval and must not convert the work into direct main-session implementation. If authorization exists but the subagent tool is unavailable, overloaded, timed out, close confirmation hangs, or dispatch is policy-blocked, record that as `worker-unavailable` using the narrow fallback evidence path.

```yaml
subagent_runtime_safety:
  codex_authorization:
    authorized_phrases:
      - b
      - 자동
      - 그럽시다
      - 진행해줘
      - 시작합니다
      - 진행합시다
      - 진행하자
      - 진행하자고
      - 진행시켜
      - 가자
      - 고
      - 고고
      - 해보자
      - 해보자고
      - 오케이 해줘
    review_intent_phrases_excluded:
      - 확인해줘
      - 검토해줘
      - 봐줘
    missing_authorization_state: needs_subagent_authorization
    missing_authorization_policy: "Stop before Step 5 and ask; do not silently fallback to main session."
  default_wait_seconds: 60
  max_wait_seconds: 180
  wait_timeout_policy: "After a bounded wait_agent timeout, stop relying on that worker result and continue through worker-unavailable fallback when replacement verification can prove the claim."
  close_subagent: "Attempt cleanup when useful, but do not block the issue workflow on close_agent confirmation after the close wait is bounded or the result is no longer needed."
  close_agent_hang_policy: "If close_agent hangs or cannot confirm promptly, record close-agent hang or close skipped in Workflow Trace and continue in the main session."
  retry_with_narrower_scope: "Retry once only with a smaller, concrete task and an explicit output contract."
  local_verification_replacement: "Use direct file inspection, command output, or reproduced checks when they prove the same claim."
  fallback_record_required_fields:
    - reason_for_fallback
    - elapsed_wait_or_timeout_marker
    - close_agent_status
    - replacement_verification_command
    - root_cause_category
    - residual_risk
  root_cause_categories:
    - prompt_scope_too_broad
    - tool_runtime_delay
    - unclear_completion_condition
    - long_running_command
    - missing_output_contract
    - unknown
```

Subagent fallback evidence must classify one root cause and include short evidence. Subagent output remains input evidence; final judgment and gate claims stay with the main agent.

### Dispatch Mode (foreground vs background, POK-328)

결과가 있어야 다음 단계로 못 가는 **외길(single-path, result-blocking) 워커는 백그라운드로
보내지 않는다** — 앞에서 기다리는(foreground) 디스패치만 허용한다. 백그라운드 디스패치는
main이 그동안 수행할 독립 병렬 작업이 실제로 있을 때만 쓴다.

근거: bounded waiting(아래)과 retry ladder는 "main이 기다리고 있다"를 전제한다. 백그라운드로
보내면 60초 한도를 셀 주체가 사라져 규칙이 구조적으로 우회되고, 워커 stall이 침묵 속에
묻힌다 (2026-06-10 POK-328 리뷰 워커 50분 침묵 실사례). 문서에 있는 규칙 ≠ 작동하는 규칙 —
규칙의 전제(대기 주체)를 실행 경로가 보존해야 한다.

### Timeout and Close-Agent Fallback

Bounded waiting applies to both worker result collection and worker cleanup.

Rules:

- A `wait_agent` timeout means the main session may stop relying on that worker result after the configured wait budget is exhausted.
- A `close_agent` or equivalent cleanup call is best-effort once the worker result is no longer needed. If close confirmation hangs or cannot be observed promptly, the workflow continues.
- Missing user authorization is still `needs_subagent_authorization`, not `worker-unavailable`.
- Retry at most once, and only when the next attempt is a smaller, concrete task with a clearer output contract.
- Replacement verification is mandatory before claiming the same result. Use direct diff inspection, focused tests, doctor output, or reproduced command evidence.

Workflow Trace must record:

```text
Workers: none (narrow fallback)
Fallback reason: worker-unavailable
Subagent timeout: <wait_agent timeout | dispatch unavailable | policy-blocked | not applicable>
Close-agent status: <not attempted | closed | timed out | hung | skipped>
Replacement verification: <commands or inspection summary>
Residual risk: <none | short risk statement>
```

If post-change review is skipped because the review worker is unavailable, the
trace must include replacement review/verification. Doctor/checklist warning is
appropriate when `Post-change review reason: worker-unavailable` appears without
`Replacement verification:`.

### Workflow Trace and Metrics Evidence (POK-165)

For v0.10.0+ gate-passed issue execution, subagent usage is not considered proven unless the issue card and metrics agree.

Runtime support claims are governed by `docs/v0.16.0/runtime-capability-matrix.md`. This standard defines Worker Task evidence, but it does not upgrade Claude, Codex, Antigravity, Kimi, or any provider to runtime support without the proof level required by that matrix.

Required issue-card evidence:

```text
## Workflow Trace

Step 2: <a/b/c> (<label>)
Workers: <worker types dispatched, or "none (narrow fallback)">
Fallback reason: <worker-unavailable | global-state-only | cross-file-invariant | trivial-scope>
Authorization: <authorized | needs_subagent_authorization | not_required>
Metrics: .ai-os/runs/YYYY-MM-DD/POK-XXX/metrics.json
```

Rules:

- `Workers:` lists actual dispatched worker kinds such as `docs_worker`, `code_worker`, or `review_worker`.
- `Workers: none` requires `Fallback reason:` with one allowed enum.
- `needs_subagent_authorization` is an authorization state, not a fallback reason.
- `worker-unavailable` means authorization existed but dispatch failed, timed out, close confirmation hung, or was policy-blocked.
- `subagent_count` in `metrics.json` must match the trace intent: positive when workers ran, `0` only when `Workers: none` or read-only-only evidence explicitly explains the boundary.
- Main-session direct work on durable docs/code/cleanup/QA must cite the fallback enum and replacement verification.

Hook-enforceable vs LLM-response-only:

| Item | Class | Evidence |
|---|---|---|
| `Workflow Trace` presence | doctor-enforceable | issue card section |
| `Workers:` / fallback enum | doctor-enforceable | issue card lines |
| `subagent_count` | doctor-enforceable | `metrics.json` |
| exact natural-language final response wording | LLM-response-only | runtime proof or deferred evidence |

## Project-Level Skill Tier & Routing Class Registry (POK-236, POK-223 implemented)

POK-236 (multi-chat project operations) defines a project-level skill tier above
the existing issue-level skills. POK-223 implements the first bootstrap slice:
project-local `.pokit/` state, default `common / COM`, project list/use/init
helpers, and `project_creation` validation in `scripts/pokit-routing-decision.mjs`.

Skill tiers:

```text
project level   /pokit.project   new · switch · list        (POK-223 bootstrap)
issue level     /pokit.backlog · /pokit.issue · /pokit.next · /pokit.clarify
```

`routing_decision` request_class registry:

```text
enforced now (pokit-routing-decision.mjs):
  issue_authoring · issue_modification · issue_grooming
  definition_change · readiness_transition · issue_execution
  project_creation   # emitted by /pokit.project new before any project mutation
```

Rules:

- `/pokit.project new` must emit a `routing_decision` with `request_class:
  project_creation` before creating `.pokit/`, `issues/`, or registering the
  project — the same recommend -> approve -> register chokepoint pattern the
  issue-level skills use.
- Project ID prefixes are assigned at creation and must be unique across the
  `~/.pokit` registry (see `docs/v0.13.0/multi-chat-project-operations.md`).
- `project_creation` is limited to project bootstrap state. Session leases,
  worktrees, push policy, and packaged CLI distribution remain separate slices.

## Payload Contract

```yaml
issue_id: POK-003
task: bounded task
permission_level: read_only
runner_assignment:
  worker_kind: planner_worker|implementation_worker|review_worker|data_worker|qa_worker|main_session
  difficulty: simple|standard|complex|critical
  model_tier: fast|standard|strong|max
  runtime_preference: auto|codex|claude
  provider_model_source: config_resolved_only
allowed_context:
  - ".ai-os/POK-003.md"
allowed_files: []
required_response_format:
  - agent-result markdown
  - verification markdown
durable_outputs_written_by: main_agent
forbidden:
  - external_write
  - final_done_claim
  - global_state_edit
```

`runner_assignment` is optional runner payload metadata. It is not POK frontmatter, and concrete provider model names must be resolved from config at runtime rather than stored in issues as source-of-truth.

## Subagent Result Contract

Subagent result payloads use Markdown with YAML frontmatter plus body sections. For `read_only`, the subagent returns this payload to the main agent and does not write files. The main agent writes durable artifacts when persistence is needed. For `write_scoped`, the subagent may write the same artifact format only inside allowed files.

### `agent-result.md`

```markdown
---
artifact_type: agent_result
schema_version: 1
parent_issue: POK-003
subtask_id: POK-003-A
permission_level: read_only
agent_role: reviewer
status: completed
can_write: false
created_at: 2026-05-19
handoff_to_parent: true
---

# Agent Result

## Task

## Findings

## Evidence

## Risks

## Suggested Parent Update

## Verification
```

### `verification.md`

```markdown
---
artifact_type: verification
schema_version: 1
parent_issue: POK-003
subtask_id: POK-003-A
permission_level: read_only
status: pass
created_at: 2026-05-19
---

# Verification

## Checks

## Result

## Evidence

## Remaining Risk
```

Required result rules:

- `agent-result` and `verification` result payloads must use YAML frontmatter plus Markdown body.
- `parent_issue`, `subtask_id`, `permission_level`, `status`, and `schema_version` are required.
- `permission_level` must match the invocation payload.
- `can_write: false` is required for `read_only` results.
- Hook allow/deny decisions are not runtime execution proof; they only classify whether the Task requested durable mutation.
- `handoff_to_parent: true` is required when the result should be integrated.
- `read_only` subagents return result payloads; main agent owns durable file writes.
- Subagents cannot mark the parent issue done, update global state, or approve external writes.
