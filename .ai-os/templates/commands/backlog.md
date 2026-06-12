# /pokit.backlog — Backlog Flow MVP 계약

## Purpose

PO의 자연어 요청을 바로 PRD/spec/code로 만들지 않고, 먼저 Backlog Refinement로 다듬어 issue graph recommendation으로 변환한다.
승인 전에는 파일을 쓰지 않으며, 승인 후 생성된 ready issue만 `/pokit.issue` 실행 후보가 된다.

`/pokit.backlog` owns issue creation, issue modification, grooming, definition changes, and readiness transitions.

## Trigger

- `/pokit.backlog`
- `/pokit.backlog <요청>`
- 자연어:
  - "새 이슈 만들어줘"
  - "POK-XXX 보완해줘"
  - "이슈 수정해줘"
  - "그루밍하자"
  - "정의/AC/준비상태 수정해줘"
  - "만들고 싶어"
  - "이슈로 만들어줘"
  - "백로그에 넣어줘"
  - "PRD 만들어줘"
  - "요구사항 정리해줘"

## Mutation Contract

```yaml
backlog_output:
  mode: recommend_only | create_after_approval
  mutates_state: false
  requires_approval: true
  project_routing: existing_project | new_project | one_off | shared_ops
  scope_routing: single_issue | spec_needed | sprint_needed | roadmap_needed
  graph_root: POK-XXX | null
  proposed_issue_paths: []
  created_issue_paths: []
  first_recommended_issue: POK-XXX | null
  blocking_questions: []
  fallback_reason: null | subagent_unavailable | subagent_timeout | subagent_policy_blocked
  approval_before_mutation: true
```

Rules:

- Recommendation card 출력은 approval이 아니다.
- PO 승인 전에는 issue file, index, current state를 수정하지 않는다.
- 승인 후에만 `mode: create_after_approval`, `mutates_state: true`로 전환한다.
- 승인 후 issue file 생성/수정/그루밍/정의 변경/준비상태 전환 스크립트를 실행하기 전에 `routing_decision` 영수증을 먼저 남긴다.
- 승인 후 durable mutation은 `PO approval` + `routing_decision` + mutation receipt/trace가 한 묶음이어야 한다. Recommendation prose alone is not a mutation receipt.
- `/pokit.issue`는 backlog authoring이 아니라 active issue 1개 실행 엔진이다.
- `/pokit.issue`는 issue creation, issue modification, grooming, definition changes, readiness transitions를 수행하지 않는다.
- `approval_before_mutation`은 subagent unavailable fallback에서도 유지된다.

Routing receipt:

```bash
node scripts/pokit-routing-decision.mjs --issue <POK-XXX> --selected-skill pokit.backlog --request-class issue_authoring --decision-reason "<why this user request is backlog authoring>"
```

The resulting `routing_decision` must contain `selected_skill: pokit.backlog`. Use `request-class` values that match the mutation: `issue_authoring`, `issue_modification`, `issue_grooming`, `definition_change`, or `readiness_transition`.

Beginner starter CLI flow after PO approval:

```bash
node scripts/pokit-issue-create.mjs --title "<issue title>"
node scripts/pokit-list-issues.mjs
node scripts/pokit-issue-use.mjs <ISSUE-ID>
node scripts/pokit-doctor.mjs
```

Use `pokit-issue-create` for issue creation receipts, `pokit-list-issues` to confirm the available IDs, and `pokit-issue-use` to select the ready issue. Do not imply a mutation receipt exists unless a starter script or explicit manual trace actually created it.

## Main/Subagent Authoring Boundary

`/pokit.backlog`에서 subagent는 제안자/검토자이고, main session은 발행자/상태 관리자다.

```yaml
main_session_owns:
  - final_issue_ids
  - issue_file_creation
  - issue_index_updates
  - sprint_scope_updates
  - inventory_decision_scope_reflection
  - current_state_updates
  - first_recommended_issue_decision

subagent_may:
  - candidate_issue_draft
  - dependency_order_review
  - blocking_question_detection
  - over_scope_readiness_risk_review

subagent_must_not:
  - create_issue_files
  - edit_ai_os_current
  - edit_ai_os_issue_index
  - edit_sprint_scope
  - decide_final_active_issue
  - mutate_without_po_approval
```

Authoring flow:

```text
draft -> review -> recommendation card -> PO approval -> main creation
```

Rules:

- Draft/review는 내부 준비 단계이며 PO 승인이나 mutation 권한이 아니다.
- Recommendation card는 PO 확인 표면이다.
- PO approval만 `create_after_approval` mutation 권한을 연다.
- 실제 issue file 생성과 `.ai-os/current.md`, `.ai-os/issue-index.md`, sprint scope 반영은 main session만 수행한다.
- Research/spec inventory 산출물이 accept/defer/drop/split-needed 후보를 만들면, 문서 Decision Register만으로는 부족하다. Main session은 PO 승인 후 sprint `release-scope.yaml`/backlog에 반영하거나 `deferred-with-reason`으로 남긴다.
- 최종 active issue와 `first_recommended_issue` 결정은 main session 책임이다.
- `/pokit.issue` subagent fan-out 흐름은 이 계약의 범위 밖이며 변경하지 않는다.

Subagent unavailable fallback:

```yaml
subagent_unavailable_fallback:
  allowed_phase: recommend_only
  main_fallback_allowed: true
  fallback_reason_required: true
  fallback_reason_surface:
    - recommendation_card
    - structured_output
  approval_before_mutation: true
```

- Subagent가 unavailable, timeout, policy-blocked이면 main fallback으로 recommendation을 만들 수 있다.
- 이때 fallback reason은 recommendation card 또는 structured output에 남긴다.
- fallback 상태에서도 issue file, index, current state, sprint scope는 PO 승인 전 수정하지 않는다.

After approval:

```yaml
backlog_output:
  mode: create_after_approval
  mutates_state: true
  requires_approval: false
  created_issue_paths:
    - projects/<project>/issues/POK-XXX.md
  authoring_path: pokit.backlog
  authoring_contract_version: backlog-flow-mvp-v1
```

## Classification

```yaml
project_routing:
  allowed:
    - existing_project
    - new_project
    - one_off
    - shared_ops

scope_routing:
  allowed:
    - single_issue
    - spec_needed
    - sprint_needed
    - roadmap_needed
```

`issue_type`은 기존 실행 enum을 유지한다.

```yaml
issue_type: spec | implementation | hotfix | cleanup | release
work_type: prd | product_spec | roadmap | prototype | analysis | development | qa | ops | research | planning | decision
artifact_type: prd | spec | roadmap | prototype | analysis_memo | qa_plan | code_change | release_note | decision_log
```

## Issue Item Definition

```yaml
id: POK-XXX
goal: "<observable goal>"
issue_type: spec
work_type: prd
artifact_type: prd
produces:
  - artifacts/<project>/prd.md
consumes:
  - backlog_request
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

## Child Issue / Worker Task

- Child Issue: 독립 gate/history/artifact를 갖는 issue graph 노드.
- Worker Task: 한 issue 내부에서 subagent에게 맡기는 dispatch 단위.
- 기존 `Sub-issues` 용어는 compatibility alias로만 사용한다.

Worker task:

```yaml
worker_tasks:
  - id: POK-XXX-W1
    worker_type: docs_worker
    purpose: "<bounded task>"
    allowed_paths:
      - <exact path>
    inputs:
      - original_request
    expected_output:
      - <artifact-or-finding>
    constraints:
      - <constraint>
    verification:
      - <check>
    depends_on: []
```

## Sprint / First Recommended Issue

Sprint는 같은 목표를 향해 실행할 issue graph subset이다.

`first_recommended_issue`는 같은 `graph_root` 안에서:

- `depends_on`이 비어 있거나 모두 완료됐다.
- `recommended_order`가 가장 낮다.
- `definition_readiness: pass`다.
- required blocking question이 없다.

## Definition of Ready

- `required_for_ready: true` 질문이 하나라도 남으면 `definition_readiness: draft`.
- `draft` issue는 생성 후보일 수 있지만 `/pokit.issue` 실행 후보가 아니다.
- `pass` issue만 active 전환 및 `/pokit.issue` 후보가 된다.

## Backlog Refinement Surface

Backlog Grooming은 legacy/구어 표현이고, 사용자 표면 기본 용어는 Backlog Refinement다.
Refinement는 specify와 닮았지만 같은 단계가 아니다.

| Flow | User question | Output |
|---|---|---|
| Backlog Refinement | 이 일을 지금 할지, 바로 시작 가능한지 | 작업 후보, 준비 상태, 확인 질문, 먼저 할 일 |
| Specify | 무엇을 어떻게 만들지 | PRD/spec/AC/plan |
| Issue Execution | 준비된 일을 완료할 수 있는지 | 산출물, 검증 근거, 완료 기준 통과 |

User-facing terms:

```text
작업 후보
준비 상태
먼저 할 일
확인 질문
issue modification
grooming
definition changes
readiness transitions
완료 기준
```

System-facing fields stay in structured output:

```text
issue_graph
definition_readiness
first_recommended_issue
blocking_questions
gate / evidence / Workflow Trace
```

## Recommendation Card

Small:

```text
╭─ Backlog Refinement
│ 요청      <original request>
│ 분류      existing_project / single_issue
│ 작업 후보  POK-XXX <title>
│ 준비 상태  ready
│ 먼저 할 일 POK-XXX
│ 확인 질문  none
│ 시스템    first_recommended_issue=POK-XXX fallback=<fallback_reason or none>
╰─ 승인하면 issue file을 생성합니다.
```

Full:

```text
╭─ Backlog Refinement
│ 요청      <original request>
│ 분류      <project_routing> / <scope_routing>
│ 추천 이유  <why refinement is safer than direct execution>
│
├─ 작업 후보
│  1. POK-XXX <title>  [work_type/artifact_type]  준비=<ready|refine 필요>
│  2. POK-YYY <title>  depends_on=[POK-XXX]
│
├─ Sprint Candidate
│  <sprint_candidate or none>
│
├─ 먼저 할 일
│  <POK-XXX or blocked>
│
├─ 확인 질문
│  - <required question or none>
│
├─ 시스템 기록
│  graph_root=<POK-XXX> first_recommended_issue=<POK-XXX|null>
│  fallback=<fallback_reason or none>
╰─ 승인 전에는 파일을 쓰지 않습니다.
```

## Drift Guard Tokens

`.ai-os/templates/commands/backlog.md`, `.claude/commands/pokit.backlog.md`, `.claude/skills/pokit-backlog/SKILL.md`는 아래 토큰을 공유해야 한다.

```text
project_routing
scope_routing
work_type
artifact_type
recommended_order
graph_root
sprint_candidate
definition_readiness
parallel_candidates
integration_issue_needed
conflict_scope
Worker Task
first_recommended_issue
required_for_ready
main_session_owns
subagent_may
subagent_must_not
subagent_unavailable_fallback
fallback_reason
approval_before_mutation
draft -> review -> recommendation card -> PO approval -> main creation
Backlog Refinement
작업 후보
준비 상태
먼저 할 일
확인 질문
```
<!-- starter:begin -->
# /pokit.backlog

Use this command when a request needs issue creation, grooming, definition refinement, acceptance criteria, or readiness changes.

Recommended flow:

1. Read `.ai-os/current.md`.
2. Inspect the relevant issue or create a recommendation.
3. Explain the proposed issue change before mutating files.
4. Apply only the approved change.
5. Run `node scripts/pokit-doctor.mjs`.

Beginner CLI flow after approval:

```bash
node scripts/pokit-issue-create.mjs --title "<issue title>"
node scripts/pokit-list-issues.mjs
node scripts/pokit-issue-use.mjs <ISSUE-ID>
node scripts/pokit-doctor.mjs
```

Use `pokit-issue-create` for issue creation receipts, `pokit-list-issues` to confirm the available IDs, and `pokit-issue-use` to select the ready issue.

Backlog work prepares issues. It does not claim execution gates.

Public contract tokens: `pokit.backlog`, `pokit.issue`, `routing_decision`, `PO approval`, `mutation receipt`, `Verification`, `gate evidence`.

Before durable mutation, confirm PO approval and leave a mutation receipt for issue creation, issue modification, grooming, definition changes, or readiness transitions.
<!-- starter:end -->
