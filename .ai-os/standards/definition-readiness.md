# Definition Readiness Standard

POKit issue가 "생성됨"과 "개발 착수 가능함"을 분리하기 위한 표준이다.

## Responsibility Boundary

| Surface | Responsibility | Not Responsible For |
|---|---|---|
| Roadmap | 장기 방향, 릴리스 흐름, 우선순위 판단 기준 | 개별 이슈 AC 확정 |
| Sprint Spec | 이번 sprint의 문제, 목표, 범위, 제외 범위, 성공 기준 | 모든 하위 이슈 상세 구현 |
| Issue Definition | 개발 착수 가능한 문제, 목표, AC, 산출물, 검증, 의존성, 제외 범위 | 장기 로드맵 재작성 |

## Lifecycle

```text
Roadmap
  -> Sprint Spec
  -> Issue Draft
  -> Issue Definition Pass
  -> Ready for Implementation
  -> Development
```

State mapping:

| Stage | Required State |
|---|---|
| Issue Draft | `status: candidate` |
| Issue Definition Pass | `status: accepted` or `definition_readiness: pass` |
| Ready for Implementation | `status: accepted` with no unresolved Ready Gate question |
| Development | `status: in_progress` |

`ready` is not a status enum. Use `definition_readiness: pass` when a card must record readiness without changing `status`.

## Ready Gate

Before implementation starts, answer all six questions:

1. Is the user or operational problem clear?
2. Is the observable change after completion clear?
3. Is the non-scope for this issue clear?
4. Are the AC independently verifiable?
5. Are outputs and verification commands or review criteria defined?
6. Are dependencies and predecessor issues clear?

If any answer is unclear, keep the issue as `candidate` or mark `definition_readiness: draft`.

## Backlog Flow Readiness

`/pokit.backlog` may recommend or create draft issues, but it must not route a draft issue to `/pokit.issue`.

Backlog-authored issue readiness:

```yaml
definition_readiness:
  draft:
    meaning: "실행 필수 정보가 부족하거나 blocking_questions가 남아 있음"
    executable_by_pokit_issue: false
  pass:
    meaning: "goal, artifact contract, dependencies, AC, required inputs가 실행 가능 수준"
    executable_by_pokit_issue: true
```

Required issue item fields for `definition_readiness: pass`:

- `goal`
- `work_type`
- `artifact_type`
- `produces`
- `consumes`
- `depends_on`
- `recommended_order`
- `graph_root`
- `sprint_candidate`
- `definition_readiness`

Execution expansion fields are allowed but do not start multi-issue execution in the MVP:

- `parallel_candidates`
- `integration_issue_needed`
- `conflict_scope`

Blocking question policy:

```yaml
blocking_questions:
  - question: "<question>"
    required_for_ready: true
```

- Any unresolved `required_for_ready: true` question keeps `definition_readiness: draft`.
- `required_for_ready: false` may remain as an assumption if the `Artifact Contract` marks it explicitly.
- A draft issue may be stored as a candidate backlog item, but it is not a `/pokit.issue` execution candidate.
- Only `definition_readiness: pass` issues can be recommended as `first_recommended_issue`.

Status/readiness mapping:

| status | definition_readiness | `/pokit.issue` execution |
|---|---|---|
| candidate | draft | blocked; ask/clarify first |
| candidate | pass | candidate after PO active transition |
| in_progress | pass | executable active issue |
| gate_passed | pass | do not rerun; use `/pokit.next` |

## Sprint as Issue Graph Subset

A sprint is an issue graph subset selected for one execution window toward the same goal.
It is not merely a flat issue list.

`first_recommended_issue` is selected within one `graph_root` by:

1. No unresolved `depends_on`.
2. Lowest `recommended_order`.
3. `definition_readiness: pass`.
4. No unresolved required blocking question.

## Scope Spec and Sprint Kickoff

Sprint scope specs and kickoff cards also pass through Definition Readiness.

They may be lighter than implementation issues, but they still need:

- why this sprint exists
- what is included and excluded
- gate conditions
- accepted candidate list or candidate routing policy
- PO approval boundary

## PRD-lite Policy

POKit does not require a separate PRD by default.

Default:
- The issue card is the mini PRD + execution Spec.
- Sprint Spec may include a short Product Brief section when product context is needed.

Separate PRD or Product Brief is required when any of these apply:
- user flow changes substantially
- multiple sprints are affected
- UI/UX is central to the outcome
- many policy or alternative decisions must be preserved
- the change is difficult to reverse

Separate PRD is normally unnecessary for:
- internal cleanup
- narrow tooling correction
- documentation alignment
- work where sprint spec and issue AC fully close the verification criteria

For large changes, use Backlog Flow issue graph decomposition:
- parent/root issue = PRD-lite and decision boundary
- child issues = independent gate/history/artifact nodes
- Worker Tasks = in-issue execution slices with disjoint write scopes

## PO Summary Schema

For PO-facing spec or decision-heavy cards, add `## PO Summary` near the top.

Use these five lines:

- **왜 하는가**: the problem or opportunity
- **끝나면 뭐가 달라지는가**: observable outcome
- **PO가 확인할 것**: the decision or review needed from the PO
- **위험**: main tradeoff or failure mode
- **다음 행동**: next concrete action

PO Summary is a decision surface. It does not replace AC, Gate, QA, or verification evidence.

## Hotfix Classification

Use `hotfix_for` when a sprint-mid issue is reactive rather than planned.

A case is a hotfix when at least two are true:

1. It was not in the accepted sprint scope at scope approval time.
2. It was triggered by a nearby gate failure, surfaced user issue, or external incident.
3. It must be handled in the same sprint.
4. It includes or requires a prevention rule / AFR.

Schema:

```yaml
issue_type: implementation
hotfix_for: POK-XXX
hotfix_trigger: "POK-XXX gate 직후 인접 실패 발견"
```

Cross-sprint work is not a hotfix. Route it as planned work in the next sprint.

## Existing Issue Policy

Do not rewrite all historical issues.

Apply this standard to:
- new issues
- active issues
- draft issues when they are promoted for implementation
- backlog sweep classification in POK-145

Historical cards are corrected only when activated, rescoped, swept, or used as evidence.
