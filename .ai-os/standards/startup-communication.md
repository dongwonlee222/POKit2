# Startup Communication Standard

Startup/resume responses are a lightweight state restore surface. They must report the current issue, gate state, next action, and approval boundary without creating issues, editing state, running gates, or starting durable work.

## Runner Rule

For "포킷 시작", "시작하자", "이어서 하자", or similar restart phrases, run:

```bash
node scripts/pokit-runner.mjs "<restart phrase>"
```

Output the returned `renderedLifecycleCard` exactly. Do not freestyle, summarize, reorder, rename fields, or replace token context with file-count wording. If the runner cannot be executed, use the fallback template below and say runner execution was unavailable.

## Post-Trigger Checklist

After rendering the Startup Card:

1. Check `.ai-os/sprints/{active_sprint}/release-scope.yaml` only when startup rules require candidate/sprint routing.
2. If no accepted candidate remains, first resolve any non-empty `candidate_decision_gate.decide`.
3. Only when no candidate and no unresolved decision gate remain, check whether sprint-close is needed.

Rules:
- State must not be mutated without explicit PO input.
- Do not show Next Path Card mid-sprint.
- Full doctor, full tests, broad evals, release packaging, and gate claims require explicit durable-work or gate approval.

## Fallback Template

```text
╭─ 🚀 POKit2 세션 시작
│
│ 접속
│   일시    YYYY-MM-DD HH:mm KST
│   모드    상태 확인
│
│ 현재 진행
│   프로젝트  ...
│   스프린트  vX.Y.Z (mid-sprint, candidates 잔여 N)
│   이슈      POK-XXX
│   상태      status: ... / gate_state: ...
│   최근 결정 POK-XXX 먼저, POK-YYY 이후
│   다음      ...
│
│ 컨텍스트
│   시작 5.7k / 작업 0 / 예상 +20.9k
│
├─ 입력 대기
│   <현재 gate_state에 맞는 안내 1줄만 선택>
│   애매하면 /pokit.clarify 로 AC/범위를 먼저 정리합니다.
│   확인 전에는 이슈 생성, 파일 수정, 게이트 실행을 하지 않습니다.
╰─
```

Route line examples:
- `gate_state: gate_passed` → `"진행해줘" → /pokit.next 로 다음 이슈 전환.`
- `gate_state: pending` → `"진행해줘" → /pokit.issue 로 현재 이슈 실행.`
- 이슈 생성/수정/그루밍/정의 변경/준비상태 전환 요청 → `/pokit.backlog`.

Context line:
- `시작`: startup read-order context already loaded.
- `작업`: durable work-read context already loaded. On startup cards this is `0`.
- `예상`: additional work-read context if the user approves durable work.
