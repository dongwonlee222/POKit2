# Backlog 다관점 리뷰 가이드라인

결정일: 2026-06-09
결정 이슈: POK-313
산출 유형: decision_log

---

## 결정 요약

`/pokit.backlog` 그루밍 시 다관점 리뷰를 PO 수동 요청에 의존하지 않고, 복잡한 이슈에서 조건 충족 시 기본 절차로 수행한다.

**검증 근거 (POK-317, 2026-06-08):** 단일 Opus 에이전트에게 correctness/구현설계/범위/AC명확성 4관점을 한 번에 요청 → 존재하지 않는 함수명, 틀린 파일 경로, 구현 불가 전제, grep 대상 오류 4건 발견. 단일 에이전트 다관점으로 충분히 효과적임 입증.

---

## 트리거 조건

아래 중 하나라도 해당하면 그루밍 중 다관점 리뷰를 수행한다:

```yaml
multi_perspective_review_trigger:
  any_of:
    - condition: issue_type in [spec, implementation] AND acceptance_criteria_count >= 4
    - condition: conflict_scope_files_count >= 2
    - condition: depends_on_present
    - condition: po_manual_request
  ac_count_measured_at: before_recommendation_card
```

트리거 미충족이어도 PO가 명시 요청하면 항상 수행한다.

---

## 실행 구조

### 기본 모드 — 단일 에이전트 다관점

단일 런타임 최상위 모델 에이전트에게 복수 관점 프롬프트를 한 번에 주는 방식.
4개 독립 에이전트를 분리하지 않아도 POK-317 실증상 충분히 효과적이다.

```yaml
multi_perspective_review:
  default_mode: single_agent_multi_perspective
  runtime_top_model:
    claude_code: opus
    codex: o3
    antigravity: runtime_top_model
  required_perspectives:
    - correctness_feasibility
    - completeness_gaps
  optional_perspectives: agent_discretion_by_issue_nature
  parallel_mode: optional
```

### 필수 관점 2가지

**1. 정확성/실현가능성 (correctness_feasibility)**
- 존재하지 않는 함수명, 파일 경로, API를 AC/개발 계획이 전제하는가?
- 구현 불가 전제(private 함수 접근, 미노출 심볼 등)가 있는가?
- grep/test 대상이 실제 경로/심볼과 일치하는가?

**2. 완성도/누락 (completeness_gaps)**
- AC가 독립적으로 검증 가능한가? gap이 있는가?
- conflict_scope 누락 파일이 있는가?
- depends_on 누락이 있는가?
- Non-scope가 명시되어 있는가?

### 자율 추가 관점

에이전트가 이슈 성격에 따라 자율 판단으로 추가 관점을 설정한다. 예시:
- 범위 번짐 위험 (scope creep risk)
- 테스트 커버리지 실현 가능성
- 이전 이슈와의 회귀 위험

---

## 런타임별 동작 방식

### Claude Code (기본)
- 네이티브 서브에이전트 병렬 실행 지원 (검증됨)
- 기본: 단일 Opus 에이전트 다관점 호출
- 옵션: 관점 간 교차오염 차단이 필요한 경우 관점별 분리 병렬 호출

### Codex
- thread limit / timeout 제약 환경
- 단일 o3 호출로 다관점 처리 권장
- 병렬 호출 시 thread limit 초과 여부 확인 후 진행

### Antigravity
- `define_subagent` 에뮬레이션 계약 준수 (`docs/v0.14.0/antigravity-pokit-skill-emulation.md`)
- 루트 `ANTIGRAVITY.md` 계약 따름
- 해당 런타임 최상위 모델 사용

---

## Fallback 정책

서브에이전트가 unavailable / timeout / policy-blocked인 경우:

```yaml
fallback:
  action: main_session_single_agent_multi_perspective
  record: fallback_reason: subagent_unavailable
  note: 기존 subagent_unavailable enum 재사용. 신규 enum 추가 금지.
  approval_before_mutation: true  # fallback 상태에서도 유지
```

일부 런타임만 unavailable이면 가용 런타임만으로 진행한다.
전체 unavailable이면 main 세션이 단일 다관점으로 대체한다.

---

## 리뷰 결과 전달 방식

리뷰 결과는 두 곳에 남긴다. 별도 떠다니는 산문으로 남기지 않는다.

1. **Recommendation Card** — `├─ 다관점 리뷰` 행으로 요약
2. **Output Schema** — `multi_perspective_review:` 필드로 구조화 기록

---

## 후속 구현 이슈 AC 초안

POK-313 gate 통과 후 아래 내용으로 구현 이슈를 생성한다.

### 목표

`.claude/skills/pokit-backlog/SKILL.md` 및 연관 4파일에 다관점 리뷰를 실제 절차로 반영한다.

### conflict_scope (4파일 동기화 필수)

```yaml
conflict_scope:
  files:
    - .claude/skills/pokit-backlog/SKILL.md
    - .claude/commands/pokit.backlog.md
    - .ai-os/templates/commands/backlog.md
    - .ai-os/standards/backlog-review-guideline.md
```

> doctor의 `pokit_backlog_boundary_drift` 검사가 이 4파일의 토큰 동기화를 강제한다.

### 변경 위치 5곳

**① Core Boundary 흐름** (`## Core Boundary` 내부)

```text
# 추가
-> multi_perspective_review (조건 충족 시)
```
위치: `dependency/order/readiness review` 와 `recommendation card` 사이.

**② subagent_may 목록** (`## Main/Subagent Authoring Boundary` 내부)

```yaml
# 추가
subagent_may:
  - multi_perspective_review
```

**③ 새 섹션 추가** (`## Classification` 바로 위)

`## Multi-Perspective Review` 섹션 신설.
트리거 조건, 기본 모드, 런타임별 동작, fallback 포함.
본 가이드라인 문서의 내용을 SKILL.md 계약 형식으로 압축.

**④ Recommendation Card Full graph** (`## Recommendation Card` 내부)

```text
# 추가 행
├─ 다관점 리뷰
│  정확성/실현가능성  <이상 없음 | N건 발견>
│  완성도/누락       <이상 없음 | N건 발견>
│  추가 관점         <없음 | 관점명: N건>
│  모드              <단일 에이전트 | 런타임 병렬 | fallback>
```

**⑤ Output Schema** (`## Output Schema` 내부)

```yaml
# 추가 필드
multi_perspective_review:
  triggered: true | false
  mode: single_agent | parallel | skipped | fallback
  findings_count: 0
  fallback_reason: null | subagent_unavailable
```

### Drift Guard Tokens 추가

`## Drift Guard Tokens` 섹션에 `multi_perspective_review` 토큰 추가.
4파일 동기화 doctor 검사 대상에 포함.

### 검증 기준

- `node scripts/pokit-doctor.mjs` fail=0
- `node --test tests/*.mjs` 전체 통과
- Recommendation Card에 `├─ 다관점 리뷰` 행 포함 확인
- Output Schema에 `multi_perspective_review:` 필드 포함 확인
- doctor `pokit_backlog_boundary_drift` 통과 (4파일 토큰 일치)

---

## 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 기본 실행 방식 | 단일 에이전트 다관점 (분리 병렬은 옵션) |
| 필수 관점 | 정확성/실현가능성, 완성도/누락 |
| 자율 관점 | 에이전트 이슈 성격 판단으로 추가 허용 |
| 트리거 | spec/impl + AC≥4 OR conflict_scope.files≥2 OR depends_on 존재 OR PO 수동 |
| fallback | 기존 subagent_unavailable enum 재사용, 신규 enum 금지 |
| SKILL.md 반영 | 후속 구현 이슈에서 4파일 동기화 포함 |
| 병렬 다중 에이전트 | 옵션 (교차오염 차단 필요 시만) — 현재 단계에서 deferred |
