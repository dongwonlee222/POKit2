# Skill Management Standard

외부 Claude 스킬(Layer 3)의 분류, 등록, 사용 기준을 정의한다.

---

## 3-레이어 정의

POKit2 에이전트 작업 레이어는 세 가지로 구분한다.

| 레이어 | 명칭 | 관할 문서 | 예시 |
|---|---|---|---|
| Layer 1 | 내부 runner | `communication.md` | `/pokit add`, `/pokit gate` |
| Layer 2 | 내부 subagent | `agent-invocation.md` | 병렬 검증 에이전트 |
| Layer 3 | 외부 Claude 스킬 | **이 문서** | `grill-me`, `tdd`, `pdf` |

Layer 3 스킬은 Claude Code의 스킬 시스템(`Skill` 도구)을 통해 호출되는 외부 기능 단위다.
Layer 1·2와 달리 POKit2 저장소 외부에서 설치·관리된다.

---

## 스킬 유형 분류

### `read-only`

- 파일을 읽거나 분석만 수행한다.
- 파일 생성·수정·삭제를 직접 실행하지 않는다.
- gate 증거를 오염시키지 않는다.
- POKit2 이슈 작업 중 별도 승인 없이 사용할 수 있다.

### `mutating`

- 파일 생성·수정·삭제를 직접 수행한다.
- POKit2 이슈 작업 중 사용하려면 이슈 승인이 선행되어야 한다.
- gate 증거에 영향을 줄 수 있으므로 사용 전 범위를 명시한다.

---

## 작업 분류 레이블

이슈와 스킬 양쪽에 동일한 레이블을 사용한다.

| 레이블 | 해당 작업 |
|---|---|
| `spec` | 요구사항 정의, PRD, 설계 검증 |
| `impl` | 코드 구현, 테스트 작성 |
| `hygiene` | 코드 품질, 보안, 기술 부채 정리 |
| `release` | 패키징, 문서, 릴리즈 산출물 |
| `general` | 위 분류에 속하지 않는 일반 작업 |

---

## `recommended_skills` 필드 스펙

이슈 frontmatter에 선택적으로 추가할 수 있는 필드다.

```yaml
recommended_skills:
  - skill: grill-me
    phase: spec        # spec | impl | hygiene | release | general
    type: read-only    # read-only | mutating
  - skill: tdd
    phase: impl
    type: read-only
```

### 규칙

- `required` / `fallback` 필드 없음. 스킬은 기본 optional이며 Claude가 자연스럽게 처리한다.
- 멀티 스킬은 `phase` 순서대로 순차 실행한다. 병렬 실행은 허용하지 않는다.
- 스킬이 설치되어 있지 않으면 Claude가 텍스트로 동등한 작업을 수행한다(자연 fallback).
- `type: mutating` 스킬이 목록에 있으면 이슈 담당자가 실행 전 명시적으로 확인해야 한다.

---

## 설치 체크리스트

새 스킬을 POKit2 작업에 도입하기 전 수동으로 확인한다.

- [ ] `.ai-os/skills/catalog.md`에 동일한 이름의 항목이 없는지 확인
- [ ] 유형(`read-only` / `mutating`) 분류가 확정되었는지 확인
- [ ] 작업 분류 레이블(`spec` / `impl` / `hygiene` / `release` / `general`) 지정
- [ ] `pok_usage` 값 결정 (`always` / `approved-only` / `free`)
- [ ] POKit2 이슈 작업 중 사용해도 gate 증거가 오염되지 않는지 확인
- [ ] catalog.md에 항목 추가

---

## 이슈 단계별 스킬 가이드

강제가 아닌 권고 사항이다. 이슈 유형에 따라 아래 스킬을 고려한다.

| 이슈 단계 | 권고 스킬 | 이유 |
|---|---|---|
| `spec` 이슈 | `grill-me` | 요구사항·설계의 맹점을 인터뷰로 조기 발견 |
| `impl` 이슈 | `tdd` | red-green-refactor 루프로 구현 품질 확보 |
| `release` 이슈 | `pdf`, `pptx` | 릴리즈 산출물(문서, 발표 자료) 생성 자동화 |
| `hygiene` 이슈 | `code-review`, `security-review` | 코드·보안 품질 점검 |
