# POKit2 Agent Entry

Before durable work, read:

1. `.ai-os/current.md`

Then follow the read order listed there.

Rules:
- `.ai-os` is the source of truth.
- POKit repo-local state reporting must use `.ai-os/current.md`, `.ai-os/status-board.md`, and `.ai-os/memory/session/handoff.md` first.
- `.modu-harness/state/current.json` is only a global exit-protocol auxiliary pointer; do not report it as the POKit current issue, gate, or release source.
- More specific local `AGENTS.md` and `.ai-os` rules override global `EXIT_PROTOCOL.md` for POKit state reporting.
- Do not duplicate the full read order in this file.
- Do not start durable work without a Harness Issue.
- Do not claim done without gate evidence.
- User-facing responses default to Korean.
- On restart phrases ("포킷 시작", "시작하자", "이어서 하자"), run `node scripts/pokit-runner.mjs "<phrase>"` and output the returned `renderedLifecycleCard` exactly.
  Do not freestyle, summarize, reorder, rename fields, or replace token context with file-count wording.
  If the runner cannot be executed, use the open-right ASCII Startup Template from `.ai-os/standards/communication.md` as the fallback and say runner execution was unavailable.

## Skills

- `/pokit.backlog`: 이슈 생성/수정/그루밍/정의 변경/준비상태 전환. `.claude/skills/pokit-backlog/SKILL.md` 참조.
  사용자 요청이 "새 이슈", "POK-XXX 보완", "이슈 수정", "그루밍", "AC/정의/준비상태 변경"이면 `/pokit.issue`가 아니라 `/pokit.backlog`로 진행한다.

- `/pokit.issue`: 준비된 active issue 실행 + gate workflow. `.claude/skills/pokit-issue/SKILL.md` 참조.
  이슈 생성/수정/그루밍/정의 변경/준비상태 전환을 수행하지 않는다.

- `/pokit.clarify`: AC 모호 감지 + grill-me 명확화. `.claude/skills/pokit-clarify/SKILL.md` 참조.
  `[NEEDS CLARIFICATION:]` 마커 미해소 시 doctor fail.

- `/pokit.next`: gate_passed 이후 다음 active_issue 전환. `.claude/skills/pokit-next/SKILL.md` 참조.
  트리거: "고", "다음으로", "1번", "제안대로", "바로 이어" + gate_state: gate_passed.
