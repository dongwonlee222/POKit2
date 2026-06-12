# Rule Section Rotation Standard

POKit2 `.ai-os/current.md` `## Rule` 섹션 회전 정책의 단일 진실원. POK-134에서 박제.

## 1. 목적

startup context 토큰 절감 + POK-051 enshrinement policy 의 코드 적용.

`.ai-os/current.md` 는 매 세션 시작 시 읽히는 핵심 surface다. `## Rule` 본문이 sprint 가 누적될수록 비대해지면:

- startup IO 예산 초과 (POK-051 위반)
- 과거 sprint 의 gate 로그가 현재 세션 컨텍스트를 희석
- PO/PM 가 현재 활동을 찾기 어려움

본 표준은 `## Rule` 본문을 **활성 sprint gate 로그**만 유지하고, sprint 종료 시 `.ai-os/memory/rule-archive/<sprint>.md` 로 회전한다.

## 2. 두 섹션 분리

`.ai-os/current.md` `## Rule` 영역은 두 섹션으로 분리한다.

```markdown
## Rule

> v0.9.0 sprint gate 로그 + 최근 10건 활동만 유지.

POK-XYZ 현 sprint gate 로그 항목 (회전 대상).
POK-XYW 또 다른 gate 로그.

### Precedents (pinned)

POK-012 MVP 루트 이슈 경로 고정 (영구 pin, 회전 제외).
POK-016 starter는 sanitized bootstrap 강제 (영구 pin).
```

| 섹션 | 역할 | 회전 |
|---|---|---|
| `## Rule` 본문 | 현 sprint gate 로그 누적 | sprint-close 자동 회전 |
| `### Precedents (pinned)` | 영구 선례 (decision 박제) | 회전 제외 |

### 2.1 분류 보수룰

애매하면 archive로. `### Precedents (pinned)` 진입은 PO 결정 필요. 한 줄 정책 박제만 pin, 단발성 gate 로그는 archive.

## 3. 임계

| 줄 수 | doctor 결과 | 의미 |
|---|---|---|
| ≤ 20 | pass | 정상 |
| 21–30 | warning | sprint-close 임박 신호 |
| > 30 | fail | 즉시 회전 필요 (sprint-close 또는 수동) |

카운트 대상: `## Rule` 본문에서 `POK-` 로 시작하는 줄만. 블록쿼트(`>`)/공백/`### Precedents` 섹션은 제외.

## 4. 회전

### 4.1 자동 회전 (sprint-close)

`npm run sprint-close [vX.Y.Z]` 실행 시 `scripts/pokit-sprint-close.mjs` 가 다음을 수행한다.

1. `## Rule` 본문에서 `POK-\d+` 로 시작하는 줄을 모두 추출
2. `.ai-os/memory/rule-archive/<sprint>.md` 에 append (파일 없으면 헤더 생성)
3. current.md `## Rule` 본문에서 해당 줄 제거
4. `### Precedents (pinned)` 섹션은 **건드리지 않음**

### 4.2 중간 doctor warn

sprint-close 전이라도 누적 줄 수가 21 줄 이상이면 doctor 가 warning, 30 줄 초과 시 fail 한다.

### 4.3 수동 회전

doctor fail 인데 sprint-close 시점이 아니면, 수기로 `.ai-os/memory/rule-archive/<active_sprint>.md` 에 append 하고 current.md 에서 제거. archive 파일은 append-only — 기존 내용 덮어쓰기 금지.

## 5. archive 위치

```text
.ai-os/memory/rule-archive/
├─ v0.1.0.md
├─ v0.2.0.md
├─ ...
└─ v0.9.0.md
```

sprint 별로 분리. append-only. 헤더 포맷:

```markdown
# Rule Archive — vX.Y.Z

> Sprint별 archive. Append-only. POK-134 (Rule Section Compaction).
> 정책: .ai-os/standards/rule-section-rotation.md
> 회전: sprint-close 자동 (scripts/pokit-sprint-close.mjs)
```

## 6. 후속

선례 (`### Precedents (pinned)`) 는 POK-095 (decisions/) 통과 후 forward-only 이주 예정. 이주 후에는 current.md 의 `### Precedents` 섹션을 decisions/ index 로 대체한다.

## 7. 출처

- POK-134 Rule Section Compaction (v0.9.0)
- Opus advisory v1 (정책 5건) + v2 (정정 4건) — 2026-05-25
- 관련 POK-051 (handoff compaction policy)
