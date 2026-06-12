# Communication Standard

- Reply in Korean by default.
- Start with the conclusion when the user is deciding.
- Keep options to 2 or 3.
- State the recommended option first with a short reason.
- Expand background only when the user asks.

## Startup Communication

Startup/resume rules live in `.ai-os/standards/startup-communication.md` so session start can stay lightweight. This file keeps durable work, lifecycle, and reporting communication standards.

## Output Terminology

When writing user-facing cards, status reports, next actions, or completion summaries, prefer the Quick Map in `.ai-os/standards/terminology.md`.

Fast path:

| Internal term | User-facing label |
|---|---|
| `routing_decision` | 스킬 선택 기록 |
| `Workflow Trace` | 작업 기록 |
| `after_gate_pass` | 게이트 통과 기록 |
| `receipt` | 기록 |

Keep internal field names in English when they are command, schema, or audit evidence. Do not use "영수증" as the default user-facing term.

## 이슈 시작 Before/After 시각화 규칙

이슈 실행을 제안하거나 시작할 때 Before/After 시각화를 먼저 출력한다.

형식:
- Before: 지금 사람이 수동으로 하는 것과 비용 (시간, 반복 횟수)
- After: 이슈 완료 후 달라지는 흐름
- 변화 요약: 핵심 수치나 차이 한 줄

visualization.md 규칙을 따른다 (ASCII, 상태/흐름/비교).
단순 대화나 소규모 수정에는 사용하지 않는다.

## PO/PM Response Lifecycle Card Standard

Use an open-right ASCII lifecycle card for major PO/PM-facing lifecycle moments:

- session start / resume
- work progress update
- work complete
- blocked or confirmation-needed state
- session close / handoff

Do not use lifecycle cards for ordinary conversation, short answers, or exploratory discussion. Keep those responses plain and direct.

The card is "open-right" because Korean text and emoji often break right-side border alignment. Use a left rail and transition connectors; do not use right-side borders such as `┐`, `┤`, or `┘` in lifecycle response templates.

Use emojis as status signals, not decoration:

- `🚀` session start / resume
- `🔄` work in progress
- `✅` work complete or gate pass
- `⚠️` blocked or confirmation needed
- `🧭` session close / handoff

Start and close cards must include the user's local timestamp as `YYYY-MM-DD HH:mm KST`. Work-complete cards should include a completion or verification timestamp when useful.

Lifecycle cards are governed by the PO-facing simplicity contract in `.ai-os/standards/po-facing-simplicity.md`.

Minimum templates below define the required shape. Runner-rendered or handoff-rendered cards may add a short previous-work summary, next candidate, gate evidence, or recommended route when that expansion helps the PO decide. Expansion must preserve the same card purpose and must not expose raw schema, worker routing, or failure keys as the primary PO-facing text.

Signal source labels:

| Label | Meaning |
|---|---|
| `hook` | exact event timing or enforcement captured by a hook |
| `runner` | scripted state calculation, rendering, or verification |
| `LLM 판단` | recommendation, interpretation, priority, or next-action inference |
| `human` | PO approval, rejection, or scope decision |

Recommendations in lifecycle cards must use `LLM 판단` unless they are directly produced by runner output. Human approval remains required for state transitions; a card display alone is never approval.

## Visual Title Framing (Opus-Depth Turns)

분석/통찰/advisory turn은 **박스 타이틀**로 시작한다. lifecycle 카드(╭─ 형식)와 다른 표현으로, "지금부터 깊이 있는 분석"임을 시각적으로 분리한다.

```text
═══════════════════════════════════════════════════════════════
   <emoji>  <title> — <subtitle 선택>
═══════════════════════════════════════════════════════════════
```

박스 타이틀 emoji와 사용 케이스:

| Emoji | 사용 케이스 | 예시 |
|---|---|---|
| `🦉` | Opus-depth advisory (PO 의사결정 입력) | "최종 Opus Advisory — v0.9 Day-0 Self-Audit" |
| `🔍` | 검증/감사 결과 (실증 데이터 정리) | "메타 진단 — 전체 상태 점검" |
| `📊` | 의사결정 대시보드 (N건 결정 요약) | "PO 결정 대시보드 (12건)" |
| `💡` | 메타 통찰 / 패턴 발견 | "메타 통찰" |
| `🗺️` | 진로 카드 (Next Path 등) | 기존 Next Path Card |
| `🎉` | 마일스톤 / sprint close summary | sprint close header |

박스 타이틀과 lifecycle 카드는 **둘 다 살림** — 작업 turn은 lifecycle (╭─), 분석 turn은 박스 (═══). 한 turn에 둘 다 등장할 수 있다 (분석 → 작업 시작).

박스 타이틀을 사용하지 않는 경우:
- 짧은 답변, 단순 보고, 일상 대화
- 작업 진행 카드 (lifecycle로 충분)
- 단일 결정 응답

> **박제**: 2026-05-25 (v0.9 day-0)
> **근거**: PO 명시 피드백 — "이런 타이틀 잡아주는거 좋다" + 본 turn 직전 advisory 형식 호평
> **관련 commit/POK**: 본 commit / POK-143 Self-Audit Findings
> **migration**: POK-095 decisions/ 통과 후 ADR로 이전 예정

## Immediate Correction Principle

발견된 위반/drift/패턴 재발은 **같은 turn에 즉시 시정**하고, 다음 turn으로 미루지 않는다.

근거:
- v0.4 → v0.7 회고 부재(4 sprint), POK-091 boundary 미실행(3 sprint), POK-093~096 미카드화(3 sprint) — 모두 "다음 turn/sprint로 미룬" 패턴의 누적 결과.
- v0.8 회고가 박제한 "수동 행동 의존 박제는 죽는다" 패턴의 가장 직접적 발현이 *시정의 지연*.

즉시 시정 의무가 부담되면 다음 중 선택:

1. **최소 절개 패치** — 본 turn에서 1 commit으로 시정 (권장)
2. **인라인 박제** — 별도 파일 신설 대신 active_issue 본문에 self-audit 섹션 추가
3. **명시적 deferred** — PO 명시 승인 + skip_reason + 후속 issue ID 박제

다음 turn으로 미루는 것은 *그 자체가 박제 휘발 패턴의 재발*이다. 미루는 결정도 본 turn에 명시적으로 박제해야 한다.

> **박제**: 2026-05-25 (v0.9 day-0)
> **근거**: v0.9 sprint kickoff day-0 self-audit 산물 (POK-143 §Self-Audit Findings)
> **관련 commit/POK**: e914f5f + 본 commit / POK-143, POK-144, POK-139
> **migration**: POK-095 decisions/ 통과 후 ADR로 이전 예정

Startup / resume template: see `.ai-os/standards/startup-communication.md`.

Progress template:

```text
╭─ 🔄 POKit2 작업 진행 중
│
│ 현재
│   이슈    ...
│   단계    ...
│   상태    ...
│
├─ 다음
│   ...
╰─
```

Complete template:

```text
╭─ ✅ POKit2 작업 완료
│
│ 결과
│   이슈    ...
│   상태    ...
│   완료    YYYY-MM-DD HH:mm KST
│
│ 변경
│   ...
│
│ 검수
│   tests   node --test tests/*.mjs → N/N pass
│   doctor  node scripts/pokit-doctor.mjs → pass
│   diff    git diff --check → clean
│
├─ 다음
│   ...
╰─
```

Evidence fields in `검수` are required per completion-claim.md. Omit rows that are not applicable to the active issue type.

Blocked / confirmation-needed template:

```text
╭─ ⚠️ POKit2 확인 필요
│
│ 현재
│   이슈    ...
│   상태    ...
│   이유    ...
│
├─ 다음
│   ...
╰─
```

Session close template:

```text
╭─ 🧭 POKit2 세션 종료
│
│ 종료
│   일시    YYYY-MM-DD HH:mm KST
│   이슈    ...
│   상태    ...
│
├─ 인계
│   다음    ...
│   시작    "포킷 시작"
╰─
```

Lifecycle cards are a display and decision surface. They may show recommendations, proposed state changes, approval needs, and next actions, but they do not replace human approval. A card display alone must not transition `candidate` to `accepted`, include work in `release-scope.yaml`, start durable work outside scope, create release artifacts, write externally, or mark a gate as passed.

## Final Response Format

When closing a work turn, use this order by default:

1. 변경
2. 확인할 변화
3. 검수
4. 주의

`확인할 변화` explains what changed from the user's point of view and how the user can immediately verify it.

Use this template under `확인할 변화`:

- 사용자가 바로 확인할 달라진 점:
- 테스트 문장:
- 기대 결과:

When the work changes files, repository hygiene, release artifacts, or state, prefer a compact ASCII visualization inside `확인할 변화`. The visualization should clarify what changed from the user's point of view and should stay short.

For cleanup or hygiene work, prefer:

```text
Before
------
...

After
-----
...

Removed
-------
...

State
-----
active_issue  ...
gate_state    ...
next_action   ...
```

For scope or spec work, prefer:

```text
Decision
--------
...

Next
----
...
```

For runtime or entrypoint work, prefer:

```text
Flow
----
...

State
-----
...
```

Do not force a visualization for tiny answers, pure conversation, or cases where a list is clearer. Follow `.ai-os/standards/visualization.md`: use ASCII for state, flow, and before/after comparisons, and avoid decorative diagrams.

## Session Close Response Rule

When the user explicitly ends, pauses, closes, or moves to a new session, include a concise close summary before stopping.

This rule supplements the Final Response Format. It does not replace normal work-turn final responses.

POKit state reporting is repo-local. In close responses, report `.ai-os/current.md`, `.ai-os/status-board.md`, and `.ai-os/memory/session/handoff.md` state first. Treat `.modu-harness/state/current.json` only as a global exit-protocol auxiliary pointer, not as the POKit current issue, gate, or release source.

If global `EXIT_PROTOCOL.md` and local POKit rules conflict, the more specific local `AGENTS.md` and `.ai-os` rules control POKit state reporting. Mention `.modu-harness/state/current.json` only when it was touched or intentionally left untouched; label it as auxiliary.

Include:

1. Current state: active issue, gate state, and canonical or release state.
2. Completed this session: durable issues, artifacts, or read-only reviews completed in the session.
3. Artifacts changed or created: important paths only.
4. Verification evidence: commands, gate evidence, or clearly state when verification was not run.
5. Explicit non-actions or risks: especially forbidden release, publish, destructive, or completion claims.
6. Next action: exact recommended next action.
7. Next-session first message: a short suggested phrase that asks the next session to restore and report state before acting.

Do not claim `released`, externally published, fully done, or gate-passed unless fresh gate evidence supports that claim.

Use `.ai-os/memory/session/session-summary.md` as the latest human-readable close snapshot. Keep `.ai-os/memory/session/handoff.md` as the cumulative recovery log.

## Sprint Kickoff Scope Spec

The first durable issue of every sprint must be a Scope Spec issue (`issue_type: spec`).

Required at these moments:

- New sprint or release scope begins (e.g., v0.3.0 work after v0.2.x close).
- A previously closed sprint is reopened with new candidates.
- A long pause in sprint work resumes with accumulated proposals.

Required outputs from the Scope Spec issue:

1. **Sprint identifier** — `sprint: v0.X.X` in frontmatter for all sprint-member POKs.
2. **Locked candidate list** — every issue accepted into this sprint named with rationale.
3. **Explicit deferral list** — items considered and pushed to a later sprint, with reason.
4. **Sequencing notes** — `depends_on` chains and execution order if non-numerical.
5. **Sprint folder seed** — `.ai-os/sprints/<sprint>/release-scope.yaml` and `backlog.md` initialized.
6. **Baseline pointer** — optional link to a release-facing baseline spec (e.g., `docs/v3/POKIT_V030_RELEASE_SPEC.md`) when one is produced.

Other implementation issues in the same sprint must wait for the Scope Spec to be `gate_passed` before durable work begins.

Sprint scope decisions should be backed by parallel read-only subagent verification (roadmap audit, release-spec deferred-items audit, usability/dead-feature audit) when candidates are non-trivial.

v0.2.0 followed this pattern implicitly via POK-032 v0.2.0 L3 Scope Spec; POK-064 codifies it for v0.3.0+ and pairs with Sprint Close Summary Format below.

## Sprint Close Summary Format

Session close is single-session scope; sprint close is cross-session, release-level scope. They have different output formats.

A sprint or release close summary is required at these moments:

- 마지막 active candidate가 gate_passed로 전환된 직후
- 릴리즈 archive/tag/publish 직후
- 사용자가 "스프린트 정리", "릴리즈 정리", "이번 스프린트 뭐가 달라졌는지" 등 명시적 정리 요청 시

The summary uses this 7-step structure so PO/PM can reuse it for external sharing and as next-session context:

1. **헤더** — `🎉` + 릴리즈 명 + 릴리즈 URL (있다면).
2. **작업량 박스** — 이슈 수, 신규 LOC 추정, 테스트 수 증감, 커밋 수, 기간. ASCII code-block.
3. **핵심 변화 표 (Before / After)** — 분야 컬럼은 PO/PM 가치 중심(응답 형식, 이슈 모델, 백로그, 분배 등). 정량 지표 포함.
4. **기술 아키텍처 변화 트리** — 신규 모듈 / 신규 표준 / 런타임 엔트리포인트를 디렉터리 구조 형태로.
5. **검증 증거 박스** — 전체 테스트, doctor, starter self-test, archive 크기·SHA, 교차 검증 수.
6. **흥미로운 결정들** — 회고 가치가 있는 설계 선택 3–5개 (의도적 deferral, scope 분리 이유, source-of-truth 경계 선택 등).
7. **남은 것 (다음 버전 candidate)** — 다음 릴리즈로 미룬 항목.
   출처 (POK-137 Backlog Routing Standard, 2026-05-25):
   - 특정 sprint 지정: `grep "sprint: v<next>" projects/pokit/issues/*.md`
   - 미정 parking: `grep "sprint: backlog" projects/pokit/issues/*.md`
   - 아이디어 (카드 없음): `docs/research/ideas-parking.md`
   - 폐지: `release-scope.yaml deferred_to_v0_X:` 섹션 — 더 이상 사용하지 않음
   표준: `.ai-os/standards/backlog-routing.md`
8. **마무리 한 문장** — 이번 릴리즈의 본질 + backward-compat 여부.

Sprint close summaries do not replace the `🧭` session close card; the card closes the current session, the summary closes the sprint. Both can appear in the same turn when a session ends right at a sprint boundary.

Sprint close summaries are display-only. They do not approve future scope, change `release-scope.yaml`, or transition candidate states.

## Next Path Card

Use the 🗺️ Next Path Card to present N options to the PO after a sprint ends. This card fills the gap between "past summary" (Sprint Close Summary) and "future action" (next session first message).

### Trigger Rules

Show the Next Path Card at these moments:

1. **Sprint 종료 직후** — 마지막 sprint candidate가 gate_passed로 전환된 직후 turn.
2. **Sprint-close summary 직후 turn** — Sprint Close Summary를 출력한 같은 turn 또는 직후 turn.
3. **사용자 명시 요청** — "다음 뭐해", "next path", "앞으로 어떻게 해" 등.

Do not show for mid-sprint turns, ordinary work turns, or single-issue gate passes.

### Template

```text
╭─ 🗺️ POKit2 다음 진로
│
│ 방금 종료
│   스프린트  vX.Y.Z
│   마무리    YYYY-MM-DD KST
│
│ 가능한 다음 단계
│   1) 새 sprint scope 잡기
│      → "vX.Y+1 시작하자" 또는 "다음 스프린트"
│
│   2) deferred / dropped 백로그 점검
│      → "백로그 정리" 또는 "연기된 것 확인"
│
│   3) 릴리즈 심의 / 외부 공개
│      → "릴리즈 하자" 또는 "배포 준비"
│
│   4) 이번 스프린트 회고 작성
│      → "회고" 또는 "회고 작성"
│
│   5) 휴지 (idle) — 다음 세션 예약
│      → "쉴래" 또는 "나중에"
│
├─ 입력 대기
│   위 옵션 중 하나를 선택하거나 직접 말씀해 주세요.
│   카드 표시만으로는 scope, release-scope.yaml, 상태가 변경되지 않습니다.
╰─
```

### Rules

- Display-only. The card shows options; it does not select one, start a sprint, or transition state.
- Option selection requires explicit PO input.
- Options 1–5 are the standard set. Omit options that are clearly not applicable (e.g., option 3 if no release is planned).
- `방금 종료` fields should reference the actual sprint identifier and close date.
- POK-049 renderer integration is out of scope for this standard (separate follow-up issue).
