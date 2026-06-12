# Sprint Retrospective Standard v3 — Verification-Based + Mandatory Gate + Plan Delta

> **박제**: v0.9.0 (POK-144 gate_passed 시점), v3 격상 v0.12.0 (POK-187)
> **첫 dogfood**: docs/v0.9.0/retro.md (v0.9 종료 시); v3 §8/§9 dogfood docs/v0.11.0/retro.md addendum (POK-187)
> **근거**: v0.8 회고 패턴 — "수동 박제는 죽고 doctor-bound 박제는 산다"
> **v1 → v2 격상**: v1(자유 4섹션 추상)은 v0.5/0.6/0.7 3 sprint 연속 휘발. v2는 doctor-bound 7섹션 검증.
> **v2 → v3 격상**: v2는 "무엇이 잘됐나"만 봤고 "계획 대비 무엇이 바뀌었나"는 못 봤다. v3는 §8 완료 목록 + §9 계획 대비 실제(delta 표)를 doctor-bound 9섹션으로 추가.

## 목적

v0.4 이후 4 sprint 중 3 sprint에서 회고가 작성되지 않았다(v0.5/0.6/0.7). v0.4 retro "관측성 강화" 액션이 4 sprint 묻혔다가 v0.8에서야 POK-122/125로 구현됐다. POK-091 boundary 박제("v0.6 POK-093~096")도 3 sprint 묻혀 v0.9 day-0 PO 수동 발견. 자유 의지에 맡긴 회고는 휘발한다는 실증.

v2는 회고를 **검증 가능한 7섹션 schema**로 격상하고, **doctor가 작성 자체를 의무화**한다. POK-139 Doctor-First 3원칙(A. Doctor Detection / B. Natural-Path Hook / C. Fail-by-Default)의 첫 dogfood.

## 9섹션 schema

| # | 섹션 | 필수 요건 | doctor 검증 |
|---|---|---|---|
| 1 | **점검 방법** | 재현 가능 명령(doctor/grep/find/git log 등) ≥ 1개 | 명령 토큰 grep |
| 2 | **잘된 것** | doctor-bound 산출물만 인정. 자기평가 금지 | 헤더 존재 |
| 3 | **아쉬운 것** | 실증 데이터 인용 ≥ 1개 (숫자+단위 패턴 — 0건/N건/X% 등) | 정량 패턴 regex |
| 4 | **패턴 한 줄** | 시스템 패턴 1줄 결론 | 헤더+1줄 존재 |
| 5 | **다음에 바꿀 것** | 시스템 변경 항목만. 개인 다짐 금지 | 헤더 존재 |
| 6 | **액션 아이템 표** | owner / due / follow-up 3컬럼 필수 | 표 컬럼 grep |
| 7 | **이전 회고 검증** | 직전 sprint retro 액션 1:1 점검 표 | 표 + 매핑 grep |
| 8 | **완료 목록** | sprint에서 gate_passed된 산출물 compact 목록 | 헤더 존재 |
| 9 | **계획 대비 실제** | 계획/추가/이월을 구분하는 delta 표 (항목/분류/증거 컬럼) | 표 헤더 + 분류 마커 grep |

> **v2 → v3 격상** (POK-187, v0.12.0): §8 완료 목록과 §9 계획 대비 실제를 추가했다. v0.11 회고는 무엇이 끝났는지(잘된 것)는 기록했지만 PO가 요청한 "계획 대비 실제 / 후보였다가 들어온 것 / 진행 중 추가된 것"을 한눈에 보여주지 못했다(POK-187 Brief). §9 delta 표가 이 격차를 doctor-bound로 메운다.

## §9 계획 대비 실제 — delta 표 형식 (AC#2)

sprint kickoff scope(release-scope.yaml `accepted:` 초기 항목)와 종료 시점 실제를 4분류로 구분한다.

| 분류 마커 | 의미 | 판정 근거 |
|---|---|---|
| ✅ 계획대로 완료 | kickoff scope에 있었고 gate_passed | scope spec 초기 accepted + `accepted_at` 없음 |
| ➕ 추가 완료 | sprint 진행 중 추가돼 gate_passed | `accepted_at`이 kickoff 이후 / candidate→accepted |
| ↪️ 이월 | 다음 sprint로 넘김 | release-scope `deferred:` |
| ❌ 드롭 | 폐기/취소 | drop 결정 기록 |

§9 본문 표 컬럼은 `| 항목 | 분류 | 증거 |`로 고정한다. 표 위/아래에 분류별 건수 요약 한 줄을 둔다(예: `계획대로 N / 추가 M / 이월 K / 드롭 0`). 텍스트 다이어그램으로 대체 가능하나 표 헤더 토큰(항목/분류/증거)은 유지한다.

§8 완료 목록은 §9 "✅+➕"의 compact 나열이며, 길게 반복하지 않는다(AC#4). 분석은 §9가, 부족한 점은 §3이, 다음 액션은 §5/§6이 맡는다.

## Doctor 가드 — retro_schema_compliance

```text
sprint-close 직후 (또는 다음 sprint scope spec gate_passed 직전):
  1) docs/v<sprint>/retro.md 파일 존재 확인     → 없으면 fail
  2) 7섹션 헤더 모두 존재 확인 (## 헤더 매칭)   → 누락 시 fail
  3) 요건 7번 1:1 매핑 표 존재 확인             → 없으면 fail
  4) 요건 3번 실증 인용 패턴 (숫자+단위) 확인   → 없으면 warning
  5) skip_reason 박제 시 PO 승인 commit 확인    → 없으면 fail
```

구현 위치: `scripts/lib/retro-schema.mjs` (검증 함수) + `scripts/pokit-doctor.mjs` (체커 등록, `checkSprintClose` 직후).

## Scope spec gate 차단 로직

다음 sprint의 scope spec issue가 `gate_state: gate_passed`로 전환될 때:

```text
조건: 직전 sprint(active_sprint - 1)의 retro_schema_compliance 결과
판정:
  fail               → scope spec gate 차단 (doctor fail로 다음 issue 진행 차단)
  fail + skip_reason → PO 승인 commit 확인 시 통과
  pass               → 통과
  retro 파일 부재    → fail (skip_reason 없으면 차단)
```

차단 메커니즘: `pokit-doctor` 실행 시 `retro_schema_compliance` 결과가 `gate_claim_vs_frontmatter_consistency` 체크와 같은 가드로 작동.

## 첫 적용 시점

- **v0.9.0 → v0.10.0 전환부터 의무화**
- **v0.9.0 자신도 self-dogfood** — v0.9 종료 시 `docs/v0.9.0/retro.md` 본 표준 적용 (POK-144 gate evidence)
- **v0.5/0.6/0.7 backfill 금지** — 사후 회상 회고는 검증 기반 원칙 위반. 영구 미실행 정책.
  - 이유: 회고는 실시간 실증 데이터(commit/test/doctor 결과)에 기반해야 함. 시간 지연 시 기억 왜곡 + retrofitting 위험.
  - 적용: doctor가 v0.5/0.6/0.7 retro.md 부재를 transitional 면제로 처리. 작성 시도 시 warning ("backfill 금지 정책").

## Doctor-First 3원칙 자기 검증 (POK-139 적용)

| 원칙 | 본 표준 적용 |
|---|---|
| **A. Doctor Detection** | `retro_schema_compliance` 가드 신설 — doctor 1회 실행으로 자동 검증 |
| **B. Natural-Path Hook** | `sprint-close` 명령 후처리 + scope spec gate 박제 — 자연 경로(sprint 종료) 위 |
| **C. Fail-by-Default** | 누락/스키마 위반 = fail (warning 아님), `skip_reason`은 명시 예외 경로 |

3원칙 모두 충족 → POK-139 의무 통과.

## 회고 사슬

```text
v0.4 retro (작성됨)
   │
   ▼ v0.5/6/7 retro 부재 = transitional 면제 구간 (backfill 금지)
   │
v0.8 retro (작성됨, v0.4 액션 일부 인용)
   │
   ▼
v0.9 retro (POK-144 첫 dogfood, v0.8 액션 1:1 점검 의무)
   │
   ▼
v0.10 retro (v0.9 액션 1:1 점검 의무, 사슬 계속)
```

매 sprint retro의 §7 (이전 회고 검증) 표가 사슬을 강제. v0.9 → v0.10 전환부터 doctor fail 위험.

## Template (v2)

```markdown
# vX.Y.Z Sprint Retrospective

## 1. 점검 방법

본 회고가 사용한 검증 명령:
- `node scripts/pokit-doctor.mjs > /tmp/doctor-vX.Y.Z.txt`
- `git log v(X.Y-1).Z..vX.Y.Z --oneline`
- `find docs/vX.Y.Z/ -type f`

## 2. 잘된 것 (doctor-bound 산출물만)

- POK-XXX: <산출물> — doctor pass 검증
- POK-YYY: <산출물> — gate evidence 인용

## 3. 아쉬운 것 (실증 인용 ≥ 1)

- <패턴>: <정량 데이터, 예: "3 sprint 연속 deferred", "doctor warning 11건 누적">
- <패턴>: <정량 데이터>

## 4. 패턴 한 줄

> <시스템 패턴 1줄 결론>

## 5. 다음에 바꿀 것 (시스템 변경만)

- <변경 항목 + 박제 카드 ID>
- <변경 항목 + 박제 카드 ID>

## 6. 액션 아이템

| Action | Owner | Due | Follow-up |
|---|---|---|---|
| POK-XXX 박제 | PO | v(X.Y+1).0 sprint kickoff | v(X.Y+1) §7에서 점검 |
| ... | ... | ... | ... |

## 7. 이전 회고 검증 (직전 sprint 액션 1:1 점검)

| Action (v(X.Y-1)) | 상태 | 증거 |
|---|---|---|
| <action 1> | ✅ 완료 / ⚠️ 부분 / ❌ 미실행 | <commit / POK ID / 측정> |
| <action 2> | ✅ 완료 | <증거> |

## 8. 완료 목록

이번 sprint gate_passed 산출물 (compact, §9 ✅+➕와 동일 집합):

- POK-XXX: <한 줄 요약>
- POK-YYY: <한 줄 요약>

## 9. 계획 대비 실제

계획대로 N / 추가 M / 이월 K / 드롭 0

| 항목 | 분류 | 증거 |
|---|---|---|
| POK-XXX | ✅ 계획대로 완료 | kickoff scope + gate_passed |
| POK-ZZZ | ➕ 추가 완료 | candidate→accepted (accepted_at) |
| POK-WWW | ↪️ 이월 | deferred to v(X.Y+1) |
```

## skip_reason 사용 경로

정당한 회고 미작성 사유(예: 1-issue micro sprint, infra-only hotfix sprint)는 다음 경로로 통과:

```yaml
# scope spec issue frontmatter (예: POK-XXX.md)
skip_reason: "1-issue micro sprint, retro 작성 가치 < 비용"
po_approval_commit: <commit hash>
```

PO 승인 commit message에 다음 토큰 포함:

```text
skip_reason: <동일 사유>
PO 승인: 회고 작성 면제
```

doctor 검증:
- scope spec frontmatter `skip_reason` + 매칭 commit message 둘 다 존재 → 통과
- 둘 중 하나라도 부재 → fail

남용 방지: `skip_reason` 사용 sprint 수 누적 → warning ("연속 N sprint skip → 표준 재검토 필요"). 임계값은 v0.10 sprint retro 작성 시 결정.

## start_read_order 토큰 측정 박제 (Ongoing 영역)

매 sprint retro의 §3(아쉬운 것) 또는 §4(패턴) 인용 후보:

```text
이번 sprint start_read_order 토큰 평균: ~N tokens
직전 sprint 대비: +X% / -X%
신호: token 증가 시 startup 비대화 위험 (POK-051 정책 검토 트리거)
```

측정 자동화는 POK-141(Metrics 현실 직시)에서 박제. 본 표준은 인용 *권장*에 그침 (필수 아님).

## Sprint Close Summary vs Retrospective

v1 정책 유지: 두 문서를 합치지 않는다.

| Artifact | Question | Focus |
|---|---|---|
| Sprint Close Summary | 무엇이 일어났는가? | 완료 범위, 릴리스 요약, 남은 리스크, 인계 |
| Retrospective (v2) | 다음에는 어떻게 더 잘할 것인가? | 검증 기반 패턴 + 시스템 변경 + 사슬 점검 |

Sprint Close Summary는 release/handoff 기록. Retrospective는 개선 실험을 정하는 문서.

## Writing Rules (v1 유지 + 강화)

- 한국어로 짧고 실행 가능하게 쓴다.
- 각 항목은 관찰, 영향, 다음 행동이 보이게 쓴다.
- 릴리스 노트나 완료 목록을 길게 반복하지 않는다.
- **추가 (v2)**: 자기평가 형용사(잘했다/노력했다/시도했다) 금지. doctor-bound 사실만.
- **추가 (v2)**: 액션 아이템은 owner + due + follow-up 3개 모두 없으면 작성 금지.
- **추가 (v2)**: §7 (이전 회고 검증)이 직전 sprint 액션 *모든 항목* 1:1 매핑해야 함 (선택적 점검 금지).
- **추가 (v3, POK-187)**: §8 완료 목록은 한 줄 요약만. 릴리스 노트 복붙·장문 반복 금지 (AC#4).
- **추가 (v3, POK-187)**: §9 계획 대비 실제는 ✅계획대로/➕추가/↪️이월/❌드롭 4분류를 모두 명시. 추가·이월이 0이어도 "추가 0 / 이월 0"으로 적어 계획이 그대로 갔음을 증거로 남긴다.

## 박제 영구화

```text
본 표준 통과       POK-144 gate (v0.9.0)
첫 dogfood         docs/v0.9.0/retro.md (v0.9 종료 시)
다음 sprint 검증    v0.10 scope spec gate 차단 메커니즘 동작 확인
ADR migration      POK-095 decisions/ 통과 후 decisions/0005-retro-standard-v2.md
```

## 출처

- `docs/v0.8.0/retro.md` §패턴
- `docs/v0.8.0/opus-advisory-manual-dependency.md` §3, §5.4
- `projects/pokit/issues/POK-139.md` Doctor-First 3원칙 (본 표준이 첫 dogfood)
- `projects/pokit/issues/POK-144.md` (본 표준의 박제 카드)
