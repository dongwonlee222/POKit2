# Enshrinement Policy Standard — Doctor-First 박제 정책

> 상위 목적함수: `.ai-os/standards/guard-priority-ladder.md`(추론 우선 3단 사다리). 박제 3원칙은 "어떻게 박나", 사다리는 "어디에 힘을 쓰나(추론>예방>탐지)"를 정한다.

## 배경

v0.8.0 회고 실증: doctor에 묶인 박제는 100% 작동(POK-135/138/119), 사용자 능동 호출을 요구한 박제는 0~30% 작동(POK-122/125/128/120). 차이는 의지가 아니라 *진입점이 워크플로우 자연 경로 안에 있느냐* 였다.

출처:
- `docs/v0.8.0/retro.md` §패턴
- `docs/v0.8.0/opus-advisory-manual-dependency.md` §3-5

## 3원칙

새로 박제되는 표준/계약/계측은 다음 셋 중 최소 두 개를 충족해야 한다.

- **(A) Doctor Detection** — `scripts/pokit-doctor.mjs`에 자동 검출 룰 존재. 위반 시 warning 이상 출력.
- **(B) Natural-Path Hook** — 워크플로우 자연 경로(`/pokit.issue` Step N / 자동 트리거 / 파일 저장 hook 등)에 강제 삽입되어, 사용자가 명시적으로 호출하지 않아도 적용된다.
- **(C) Fail-by-Default** — 미충족 시 doctor `fail` 또는 명시적 차단(예: 예외 필드 미기록 시 게이트 거부). warning만 출력하면 (C) 미충족으로 간주한다.

## 적용 대상

대상 `issue_type`:
- `spec` 카드 중 표준 / 계약 / doctor check / hook / SKILL / 계측 산출이 있는 것
- `contract`

비대상:
- pure scope-spec (산출이 결정 기록뿐)
- cleanup-only
- docs-only (외부 문서 작성)

## 의무

대상 카드는 본문에 다음 섹션을 포함한다.

```markdown
## Enshrinement Policy Check

- [A] Doctor Detection: yes | no | n/a — <근거 한 줄>
- [B] Natural-Path Hook: yes | no | n/a — <근거 한 줄>
- [C] Fail-by-Default: yes | no | n/a — <근거 한 줄>

Count: N/3 satisfied
```

`yes` 카운트가 2 이상이어야 통과. 1 이하면 다음 줄을 추가한다.

```
Policy exception: <PO 명시 승인 사유 1~3문장>
```

`n/a`는 `yes` 카운트에 포함되지 않는다.

## 강제 메커니즘

- **(B) Natural-Path Hook**: `/pokit.issue` Step 6 issue card update 시 본 섹션 템플릿을 자동 주입한다. 박제 위치는 `.claude/skills/pokit-issue/SKILL.md` "Enshrinement Policy Hook" 섹션.
- **(A) Doctor Detection**: `scripts/pokit-doctor.mjs` `checkEnshrinementPolicy` 함수가 적용 대상 카드를 검사한다.
  - 본 섹션 누락 → warning
  - `Count: N/3` 에서 N<2이고 `Policy exception:` 없음 → warning
- **(C) Fail-by-Default 등급**: v0.9.0 도입 단계는 warning. POK-141 metrics 가드 박제 후 fail 격상을 별도 이슈로 검토한다. 본 표준 자체는 (C)를 "no"로 자기보고한다.

## 예외 절차

1. 박제 작성자가 미충족 사유를 카드의 `Policy exception:` 줄에 기록한다.
2. PO가 카드에 해당 줄을 명시 승인한다(diff 반영으로 충분).
3. 승인 사유는 git diff로 남아 회고 입력이 된다.

## 자체 검증 (dogfood)

본 표준 자체가 3원칙을 만족하는지 POK-139 카드의 `## Enshrinement Policy Check` 섹션으로 자기보고한다.
