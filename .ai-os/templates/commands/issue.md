# /pokit.issue — Ready Issue Execution 계약

## Purpose

준비된 active Harness Issue 하나를 실행하고, Workflow Trace / metrics / gate evidence를 남긴다.
새 이슈 생성, 기존 이슈 보완, grooming, definition changes, readiness transitions는 `/pokit.backlog`가 소유한다.
`/pokit.issue`는 issue definition edits를 하지 않는다.

## Trigger

- `/pokit.issue` — 현재 active issue 실행
- `/pokit.issue <POK-XXX>` — 이미 active로 전환된 ready issue 실행 확인
- 자연어: "진행해줘", "그럽시다", "시작합니다", "진행합시다", "진행하자", "진행시켜", "가자", "고", "고고", "해보자"

Do not trigger for:
- "새 이슈 만들어줘"
- "POK-XXX 보완해줘"
- "그루밍하자"
- "정의/AC/준비상태 수정해줘"
- "백로그에 넣어줘"

Those requests route to `/pokit.backlog`.

## Routing Refusal

If the request asks for issue creation, issue modification, grooming, definition changes, or readiness transitions, stop before mutation and route to `/pokit.backlog`.

```text
이 요청은 issue execution이 아니라 backlog authoring/refinement입니다.
이슈 생성/수정/그루밍/정의 변경/준비상태 전환은 /pokit.backlog가 소유합니다.
```

## Input Collection Flow

명령 실행 시 아래 항목을 확인한다. 부족하면 `/pokit.backlog` 또는 `/pokit.clarify`로 되돌린다.

1. `active_issue` exists in `.ai-os/current.md`
2. `gate_state` is not `gate_passed`
3. active issue has `definition_readiness: pass`
4. required blocking questions are absent
5. unresolved depends_on blockers are absent

## Output Contract

`/pokit.issue` updates execution evidence for the active issue only:

- `## Workflow Trace`
- `## Gate`
- `.ai-os/runs/YYYY-MM-DD/POK-XXX/metrics.json`
- state files after verified gate claim

It does not create issue files or perform issue definition edits.

### Authoring Path Evidence (POK-165)

새 이슈 생성 또는 기존 이슈의 의미 있는 갱신은 `/pokit.backlog` authoring evidence를 남긴다.

| Field | Allowed values | Meaning |
|---|---|---|
| `authoring_path` | `pokit.backlog` | `/pokit.backlog` authoring/refinement 경로로 작성/갱신 |
| `authoring_path` | `legacy` | 기존 카드 보존; `authoring_skip_reason` 필수 |
| `authoring_contract_version` | `backlog-flow-mvp-v1` | backlog authoring 계약 버전 |

`legacy`를 사용할 때:

```yaml
authoring_path: legacy
authoring_contract_version: 0.1.0
authoring_skip_reason: <왜 현재 작성 경로 증거를 남길 수 없는지>
```

## Workflow Trace Seed

`/pokit.issue`는 실행 결과를 미리 주장하지 않는다. 다만 execution issue에는 state update 단계에서 아래 섹션이 채워질 수 있도록 빈 섹션 또는 TODO를 남길 수 있다.

```markdown
## Workflow Trace

Skill invocation: pokit-issue
Execution approval: TODO
Mode: TODO
Worker authorization: TODO
Workers: TODO
Fallback reason: TODO
Post-change review: TODO
Review findings: TODO
Metrics: TODO
```

`Skill invocation: pokit-issue`는 POK-177 이후 이슈에서 필수 실행 증거다. SKILL.md를 읽고 수동 재현한 것과 `/pokit.issue` workflow로 실행한 것을 구분한다.

`Workers: none`이면 `Fallback reason:`은 `worker-unavailable`, `global-state-only`, `cross-file-invariant`, `trivial-scope` 중 하나여야 한다. `needs_subagent_authorization`은 fallback reason이 아니라 authorization state다.

Worker authorization is not proof that workers actually ran. Do not claim automatic subagent spawn unless a supported runtime adapter exists and leaves execution evidence. If no supported runtime adapter is available, record `Workers: none (narrow fallback)` and `Fallback reason`.

`Workers:` must reconcile with metrics/evidence. Non-empty `Workers:` requires metrics `subagent_count > 0` or explicit worker evidence such as `Worker evidence:`, `Evidence source:`, or `subtask_id:`. `Workers: none (narrow fallback)` requires valid fallback reason and metrics `subagent_count == 0` when metrics exist.

`Post-change review:`는 gate claim 전 최종 산출물 검수 경로를 기록한다. 기본값은 `review_worker`이며, `global-state-only` 또는 `trivial-scope` 예외일 때만 `skipped`를 쓸 수 있다. `Review findings:`는 `none`, `fixed`, 또는 `deferred-with-reason` 중 하나로 남긴다.

Gate 이후 completion surface는 commit 상태를 명시한다. `commit_needed`는 tracked/staged/non-local untracked 변경이 남은 상태이며 커밋 또는 명시 defer 전에는 handoff를 닫지 않는다. `.pokit/` 같은 local runtime-only untracked 상태는 `local_only`로 표시하고 commit-required로 보지 않는다.

## Worker Tasks Contract

`Worker Tasks` is the official term for planned in-issue worker dispatch. Legacy `Sub-issues` is accepted only as a compatibility alias for old cards; new or meaningfully updated cards must use `Worker Tasks`.

Worker Tasks lifecycle:
- Draft Worker Tasks during issue authoring/grooming as planned work packets.
- Immediately before dispatch, verify and lock Worker Tasks against current repo state, current AC, allowed files, and disjoint write scopes.
- Record actual execution in `## Workflow Trace` (`Skill invocation: pokit-issue`, `Execution approval`, `Mode`, `Worker authorization`, `Workers:`, `Fallback reason:`, `Metrics:`). Worker Tasks are planning evidence, not execution evidence.
- Runner preview and PO-facing execution cards must be Korean. If issue metadata stores English `goal` or brief text, render a Korean fallback summary instead of leaking raw English prose.
- After `b` / `자동`, expose an execution reasoning checklist before implementation: active issue, gate state, execution approval, Worker Tasks need, worker availability, fallback reason, Post-change review plan, and Verification plan.
- Gate claim 전에는 Post-change Review Gate를 실행해 최종 diff, state files, generated/derived artifacts, focused tests, doctor output을 `review_worker`가 다시 읽게 한다. Review findings가 있으면 수정/재생성/재검증 전에는 gate-pass를 진행하지 않는다.
- For research/spec inventory issues that produce accept/defer/drop/split-needed decisions, gate claim requires a scope-reflection check: the resulting candidate changes must be reflected in the sprint `release-scope.yaml`/backlog, or explicitly recorded as `deferred-with-reason`.

Scope boundary:
- Worker Tasks are for issue-internal parallel worker execution only.
- Multi-issue parallel execution is out of scope for `/pokit.issue`; use child issues or `/pokit.backlog` recommendations instead.
- Global state, gate evidence, metrics, git staging/commit/push, and final reporting remain owned by the main/orchestrator session.

### `handoff_prompt` field on Worker Tasks

Each Worker Task may include an optional `handoff_prompt` field — a copy-pasteable, self-contained prompt for an external agent or sub-session delegate. When present, `handoff_prompt` must:

- Name the repo path.
- List the files to read.
- Describe the bounded scope.
- State what to return.

A delegate receiving only the `handoff_prompt` must need no chat context to begin work.

`handoff_prompt` must not instruct the worker to alter global state, update gate evidence, record metrics, or run `git commit`/`git push`. Those responsibilities remain with the main/orchestrator session.

### Single-session execution and opt-out

Single-session execution is always valid. When an issue meets a decomposition trigger but no Worker Tasks are needed, the issue must provide an **explicit opt-out reason** via:

- Frontmatter: `worker_tasks: not_required` WITH a non-empty `worker_tasks_skip_reason`.
- Or an explicit skip note in the `## Worker Tasks` section body.

Omitting the opt-out reason when a trigger condition is met is a doctor fail. Use the canonical field names `worker_tasks`, `worker_tasks_skip_reason` for new issues. (Legacy aliases `sub_issues`, `sub_issues_skip_reason` are accepted for old cards only.)

## Natural Language Routing Rule

자연어 요청이 새 이슈 생성, 이슈 보완, grooming, definition changes, readiness transitions를 뜻하면 `/pokit.backlog`로 라우팅한다.
자연어 요청이 ready active issue 실행 승인을 뜻할 때만 `/pokit.issue`로 실행한다.

## General User Surface Boundary

일반 사용자 작업을 이슈로 만들 때는 POKit 개발 조건을 사용자 요구사항처럼 노출하지 않는다.
사용자 표면에는 `작업 후보`, `준비 상태`, `확인 질문`, `먼저 할 일`, `완료 기준`을 우선 사용한다.

System-facing evidence는 유지한다.

```text
gate -> 완료 기준 / 통과 기준
doctor -> 자동 점검
evidence -> 검증 근거
Workflow Trace -> 작업 기록
subagent -> Worker Tasks / 내부 작업자
```

POKit 자체 개발 이슈에서는 POK ID, gate, doctor, Workflow Trace, metrics, Worker Tasks evidence를 그대로 노출할 수 있다.

## AC Quality Check

After collecting AC items, evaluate each against these criteria:
- Is it independently verifiable (no dependency on another AC to test)?
- Does it state a measurable outcome, not just an action?
- Does it contain any vague language ("적절히", "필요에 따라", "등")?

If any AC fails: add `[NEEDS CLARIFICATION: <question>]` inline.

## Clarify Auto-Suggest

After outputting the draft, check if ANY of these apply:
- issue_type is spec or implementation AND any AC contains vague language
- Any AC has a `[NEEDS CLARIFICATION:]` marker
- AC count ≥ 5 and any AC is not independently verifiable

If yes, output:
```text
⚠️ AC #N이 모호합니다. `/pokit.clarify`로 명확화를 권장합니다.
```

## Implementation Brief (for implementation/hotfix issues)

When issue_type is `implementation` or `hotfix`, add an Implementation Brief subsection to Development Plan:

```markdown
## Implementation Brief

- 관련 파일: <path> — <현재 역할>
- 따를 패턴: <기존 코드 경로 참조>
- 수정 금지: <건드리면 안 되는 것>
- 출력 형식: <Worker Task가 만들어야 할 것>
```

## Runtime Boundary

이 파일은 runtime-agnostic markdown 원본이다.
Claude Code native slash command는 별도 B5 (generate-at-install) 단계에서 `.claude/commands/pokit.issue.md`로 생성된다.
Codex / Antigravity authoring adapter는 canonical template 또는 POK-156 Issue Authoring SSoT를 참조해야 한다.

## Drift Guard Tokens (POK-165)

`.ai-os/templates/commands/issue.md`, `.claude/commands/pokit.issue.md`, Codex-facing issue authoring path는 아래 토큰을 공유해야 한다.

```text
authoring_path
authoring_contract_version
natural-language-issue-authoring
Workflow Trace
Execution approval
Mode
Worker authorization
Workers:
Fallback reason:
needs_subagent_authorization
Post-change review:
Review findings:
Implementation Brief
Worker Tasks
Sub-issues
handoff_prompt
worker_tasks_skip_reason
pre_runner
post_runner_plan
post_change_review
verification_ready
pokit-runner.mjs "b"
```

<!-- starter:begin -->
# /pokit.issue

Use this command when the active issue is ready for execution and the user explicitly approves progress.

Recommended flow:

1. Read `.ai-os/current.md`.
2. Confirm the active issue and gate state.
3. Run `node scripts/pokit-runner.mjs "진행해줘"` for the execution preview.
4. Implement the approved issue.
5. Run `node scripts/pokit-doctor.mjs` and focused verification before claiming completion.
6. Print the runner-rendered ✅ Complete lifecycle card as the final PO-facing answer: `node scripts/pokit-runner.mjs complete POK-XXX` and output its `renderedCompleteLifecycleCard` exactly. The card distinguishes `verification_ready` from `gate_passed` and never claims `gate_passed` by itself.

Issue execution owns implementation and gate evidence. It does not create or groom new issue definitions.

Public contract tokens: `pokit.issue`, `pokit.backlog`, `routing_decision`, `Execution approval`, `Worker authorization`, `Worker Tasks`, `fan-out`, `Workflow Trace`, `Fallback reason`, `Post-change review`, `Review findings`, `Verification`, `gate evidence`.

Worker authorization is not proof that workers actually ran. Do not claim automatic subagent spawn unless a supported runtime adapter exists and leaves execution evidence. If no supported runtime adapter is available, record `Workers: none (narrow fallback)` and `Fallback reason`.

Runtime support claims must follow `docs/v0.16.0/runtime-capability-matrix.md`; command routing, Skill activation, and `b` authorization do not prove runtime worker execution.

After `b` or `자동`, record execution evidence before implementation:

```text
Execution approval: b
Mode: automatic
Worker authorization: authorized
Workers: <worker list> OR Workers: none (narrow fallback)
Fallback reason: <required if no workers>
Post-change review: review_worker
Review findings: none | fixed | deferred-with-reason
```
<!-- starter:end -->
