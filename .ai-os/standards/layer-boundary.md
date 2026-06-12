# Layer Boundary: .ai-os/ vs docs/

schema_version: 0.1.0
created: 2026-05-23
source_issue: POK-090

---

## 레이어 정의

### .ai-os/ — AI 운영 레이어

AI runtime이 읽고 쓰는 운영 레이어. 하네스 상태의 source of truth.

**포함 대상:**
- harness 상태 파일 (`current.md`, `active_issue`, gate 기록)
- 이슈 파일 (`projects/pokit/issues/POK-XXX.md`)
- sprint 계획 및 릴리즈 스코프 (`sprints/`)
- AI 행동 표준 (`standards/`)
- 스킬 카탈로그 및 계약 (`skills/`, `contracts/`)
- 실패 기록 및 회고 메모리 (`memory/`)

**쓰기 주체:** AI agent (gate claim, 상태 업데이트, 실패 기록)

### docs/ — 산출물 레이어

사람이 읽는 산출물 레이어. 스펙, 계약, 릴리즈 노트, 회고.

**포함 대상:**
- 공개 사양서, API 계약 문서
- 릴리즈 노트 (외부 공유용)
- 회고 문서 (팀 리뷰용)
- 아키텍처 결정 기록 (ADR) — v0.6.0 이후 도입 예정

**쓰기 주체:** 사람 (리뷰, 의사결정, 외부 공유 목적)

---

## 경계 규칙

| 용도 | 레이어 |
|------|--------|
| AI가 gate claim 작성 | `.ai-os/` |
| AI가 상태 업데이트 | `.ai-os/` |
| AI가 실패 기록 저장 | `.ai-os/` |
| 사람이 외부 공유할 스펙 | `docs/` |
| 사람이 팀 리뷰할 회고 | `docs/` |
| 사람이 의사결정 기록 | `docs/` (v0.6.0 이후) |

**핵심 원칙:** AI는 `docs/`를 읽을 수 있지만, primary write target이 아님.
`docs/`에 AI가 쓰는 경우는 사람 요청이 명시된 경우에만 허용.

---

## .ai-os/skills/ vs .claude/skills/ 레이어 구분

두 경로는 역할이 다르며 충돌하지 않는다.

### .ai-os/skills/catalog.md — 외부 스킬 카탈로그

- **레이어:** `.ai-os/` (AI 운영 레이어)
- **역할:** 어떤 스킬이 존재하는지 등록하는 등록부 (what is available)
- **쓰기 주체:** AI agent (스킬 추가/변경 시 카탈로그 갱신)
- **읽기 주체:** AI agent (어떤 스킬을 호출할 수 있는지 파악)

### .claude/skills/pokit-issue.md — 내부 runner skill

- **레이어:** `.claude/` (Claude Code 하네스 레이어)
- **역할:** 어떻게 실행하는지 정의하는 실행부 (how to execute)
- **쓰기 주체:** 사람 또는 AI (Claude Code 설정 변경)
- **읽기 주체:** Claude Code 하네스 (실행 시 로드)

**결론:** catalog는 등록부, `.claude/skills/`는 실행부. 둘은 상호 보완 관계.

---

## 순증가 금지 원칙

v0.5 gate 조건:
- **삭제/통합 파일 수 ≥ 신규 생성 파일 수**
- new standard/contract 3개 초과 시 멈추고 재검토

**근거:** .ai-os/는 AI가 매 세션 읽는 context budget이다. 파일이 늘어날수록
컨텍스트 부하가 증가하고 일관성이 낮아진다. 새 파일을 만들기 전에
기존 파일을 통합하거나 삭제하는 것이 우선이다.

**적용 방법:**
1. 신규 파일 생성 전, 기존 파일 중 흡수 가능한 것을 먼저 확인
2. sprint 종료 시 순증가 계산 = (신규 생성) - (삭제 + 통합으로 제거된 파일)
3. 순증가 > 0 이면 gate 차단, 재검토 필요

### Net-Deletion Accounting

Release gate에서 `삭제/통합 파일 수 >= 신규 생성 파일 수`를 판정할 때는 단순한 `git status` 파일 수와 gate evidence용 회계표를 분리한다. 단순 diff는 sidecar evidence로 남기되, 최종 판정은 아래 범주 표를 명시적으로 작성한 경우에만 허용한다.

| Category | Counts as created? | Counts as removed/integrated? | Rule |
|---|---:|---:|---|
| Product surface | yes | no | 사용자가 직접 읽거나 사용하는 새 기능, 스펙, 계약, 문서 표면. 기본적으로 생성 카운트에 포함한다. |
| Validation artifact | no | no | 테스트, gate evidence, metrics, 감사 로그처럼 검증을 위해 필요한 산출물. 새 제품 표면으로 계산하지 않지만 evidence에 반드시 열거한다. |
| Physical hygiene cleanup | no | yes | `node_modules/`, build output, `.DS_Store`, stale extracted release dir처럼 Git 추적 여부와 무관하게 repo hygiene를 악화시키던 물리적 잔재 제거. |
| Generated/ignored run artifact | no | no | `.gitignore` 대상 run output, temporary metrics, generated trace. 커밋 대상이 아니며 생성 카운트에서 제외한다. |
| Moved/integrated artifact | no | yes | 기존 문서나 artifact가 새 canonical 위치로 흡수되어 원본 표면이 사라진 경우. 단순 복사는 제외하고, 이전 위치의 독립 표면이 제거됐다는 근거가 있어야 한다. |

Release gate evidence에는 다음 두 블록이 모두 있어야 한다.

1. **Strict git sidecar:** tracked/untracked 기준 created/deleted/modified 요약. 이 값만으로 조건을 만족하지 못하면 그대로 기록한다.
2. **Category accounting table:** 위 5개 category별 파일/디렉토리 목록, 포함/제외 사유, 최종 판정.

POK-099에서 사용한 validation artifact 제외와 physical hygiene cleanup 포함 해석은 grandfathered evidence로 인정한다. POK-108 이후 release/readiness gate는 이 표준을 참조하지 않은 post-hoc 재해석으로 gate pass를 주장할 수 없다.
