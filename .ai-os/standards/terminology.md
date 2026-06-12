# Terminology Output Map

## Purpose

POKit keeps internal field names and event names in English for implementation stability and token economy.
User-facing output should explain those names with short Korean labels.

This file is an output map, not a long glossary.

## Principles

- Keep internal schemas, event names, filenames, and command tokens in English.
- Use Korean labels in cards, status reports, next actions, and completion summaries.
- Show the internal English name only when it helps debugging or audit.
- Do not use `receipt` / "영수증" as the default user-facing term.
- Prefer "기록" for user-facing proof or trace language.
- Keep this map compact enough to skim quickly.

## Quick Map

| Internal term | User-facing label |
|---|---|
| `routing_decision` | 스킬 선택 기록 |
| `issue_execution_entered` | 이슈 실행 진입 기록 |
| `issue_authored` | 이슈 작성 기록 |
| `after_gate_pass` | 게이트 통과 기록 |
| `Workflow Trace` | 작업 기록 |
| `Execution approval` | 실행 승인 |
| `Worker authorization` | 워커 권한 |
| `Worker Tasks` | 작업 단위 |
| `Post-change review` | 변경 후 검토 |
| `Review findings` | 검토 결과 |
| `Verification` | 검증 |
| `gate evidence` | 게이트 근거 |
| `definition_readiness` | 정의 준비 상태 |

## Output Scope

Apply the Quick Map when writing:

- lifecycle cards
- status reports
- next actions
- completion summaries
- PO-facing choice or approval cards

Internal issue frontmatter, scripts, event logs, command names, and test assertions may keep English tokens.

## Legacy Terms

Use "기록" by default.

Use "receipt" or "영수증" only when quoting old text, naming an internal implementation concept, or describing event-log audit mechanics where the exact technical term matters.

## Non-goals

- Do not translate internal schemas to Korean.
- Do not bulk-rewrite old documents.
- Do not add doctor hard-fail enforcement in this issue.
- Do not expand this file into a comprehensive glossary.

