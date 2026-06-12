# PO Natural Language Trigger Standard

POKit accepts natural Korean phrases, but restart/resume and execution approval are different routes. The same friendly tone must not silently start durable work unless the active context is already asking for execution approval.

Related standard: `.ai-os/standards/po-facing-simplicity.md`.

## Context Boundary

| Context | Meaning | Result |
|---|---|---|
| restart/resume | no active execution approval context, or user is returning to POKit state | restore state and render startup/resume lifecycle card |
| execution approval | active `pokit-issue` pending/in_progress approval context | start or continue the approved issue workflow |
| ambiguous | phrase could be either route but context is missing | render state, ask for confirmation, do not mutate state |

`시작하자` resolves to restart/resume when there is no active execution approval context.

Execution phrases belong to the `pokit-issue` pending/in_progress approval context. Outside that context, they are treated as resume/check-state phrases or require confirmation.

## Required Trigger Mapping

The following phrases must be recognized exactly as natural-language inputs:

| Phrase | Default route without active execution approval context | Route inside `pokit-issue` pending/in_progress approval context |
|---|---|---|
| 해보자 | restart/resume or confirmation-needed | execution approval |
| 해보자고 | restart/resume or confirmation-needed | execution approval |
| 가자 | restart/resume or confirmation-needed | execution approval |
| 시작하자 | restart/resume | execution approval only when approval context is already active |
| 진행하자 | restart/resume or confirmation-needed | execution approval |
| 좋아 진행 | restart/resume or confirmation-needed | execution approval |
| 오케이 해줘 | restart/resume or confirmation-needed | execution approval |
| 그걸로 하자 | restart/resume or confirmation-needed | execution approval |

## Restart / Resume Triggers

Restart/resume triggers do not create issues, edit state, run gates, or start durable work by themselves. They restore state and show the PO-facing lifecycle card defined in `.ai-os/standards/communication.md`.

Examples:
- `시작하자`
- `이어서 하자`
- `포킷 시작`
- any required mapping phrase above when there is no active execution approval context

## Execution Approval Triggers

Execution approval triggers may start or continue work only when all are true:

1. There is an active Harness Issue.
2. The issue is in pending or in_progress approval context.
3. The assistant has already surfaced the scope or current next action.
4. The user's phrase maps to approval in the table above.

When any condition is missing, show the current state and ask for confirmation instead of starting durable work.

Progress phrases are runner preview triggers before they are execution approval. For `그럽시다`, `진행해줘`, or `시작합니다`, implementations must first run `node scripts/pokit-runner.mjs "<phrase>"`. If `renderedPreExecutionPreviewCard` is present, output that card and stop. Only `b` or `자동` after the preview enters the `pokit-issue` Step 1 workflow. `gate_passed` progress keeps the POK-181 boundary: no preview, route to `/pokit.next`.

## Mapping Function Contract

Implementations should resolve triggers in this order:

1. Read current active issue and gate state.
2. Detect whether an execution approval context is active.
3. Match the normalized user phrase against the required trigger table.
4. Return one of: `restart_resume`, `execution_approval`, `confirmation_needed`.
5. Render the appropriate PO-facing lifecycle card.

The resolver may be implemented in a runner, hook, or skill, but the user-facing result must follow the surface separation rules in `.ai-os/standards/po-facing-simplicity.md`.

## Non-Goals

- This standard does not define every possible Korean phrase.
- This standard does not override explicit user instructions such as "상태만 보여줘" or "아직 실행하지 마".
- This standard does not grant approval for destructive or out-of-scope work.

## Simplicity Checklist Evidence

| Question | Evidence |
|---|---|
| PO가 새 단어를 외워야 하는가? | No. PO는 자연어를 그대로 쓰고, route 이름은 system-facing resolver 값으로만 둔다. |
| 카드 한 화면 안에서 다음 행동이 보이는가? | Yes. 애매하면 상태 카드와 확인 요청 1줄만 보여준다. |
| doctor 또는 runner가 drift를 자동 검출할 수 있는가? | Yes. `simplicity_checklist` doctor guard와 trigger table 테스트가 누락을 잡는다. |
| 재개/진행/검수 흐름이 짧아졌는가? | Yes. 재개/진행을 자연어로 분리해 명령어 암기 흐름을 줄인다. |
