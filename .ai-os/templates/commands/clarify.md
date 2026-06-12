# /pokit.clarify — 이슈 명확화 계약

## Purpose

이슈 초안의 모호한 부분을 체계적으로 해소한다.
grill-me 깊이(집요한 질문)와 Spec Kit taxonomy(영역별 커버리지)를 결합해
AC 누락, 범위 충돌, 용어 불일치를 사전 차단한다.

## Trigger

- `/pokit.clarify` — 현재 active_issue에 적용
- `/pokit.clarify <POK-XXX>` — 특정 이슈에 적용
- 자연어: "이슈 애매한 부분 짚어줘", "AC 더 구체화해줘" — 여전히 first-class
- 자동 제안: `/pokit.issue` 초안 후 모호한 AC 감지 시 자동 제안됨 (issue-quality.md 기준)

## Ambiguity Taxonomy (POKit 7개 영역)

Spec Kit 11개 taxonomy를 POKit 맥락에 맞게 축소 적용한다.

| # | 영역 | 점검 내용 |
|---|---|---|
| 1 | 기능 범위 | "무엇을 한다"의 경계가 명확한가 |
| 2 | AC 완결성 | 모든 AC가 독립적으로 검증 가능한가 |
| 3 | 의존성 충돌 | depends_on 게이트 상태가 해소됐는가 |
| 4 | 부작용 & 롤백 | 실패 시 되돌릴 수 있는가, 파괴적 변경인가 |
| 5 | 테스트 커버리지 | 누락된 edge case나 negative case가 있는가 |
| 6 | 용어 일관성 | 도메인 언어가 이 이슈에서 정확하게 쓰였는가 |
| 7 | 완료 신호 | gate_passed를 누가 어떻게 선언하는가 |

## Q&A Flow

1. 이슈 파일 읽기 (Brief, Evidence, AC 섹션 우선)
2. 7개 영역 빠른 스캔 (자동)
3. 모호 항목 최대 5개 추출, 우선순위 정렬
4. 각 질문: 선택지 2~3개 + 권장안 명시 (grill-me 방식)
5. 답변 반영 → AC 또는 Brief 갱신 제안
5-1. user-facing behavior가 있으면 Given/When/Then 시나리오 작성 제안
6. 합의된 내용을 `## Clarifications` 섹션에 기록

## Output Contract

이슈 파일에 추가되는 섹션:

```markdown
## Clarifications

| # | 영역 | 질문 | 결정 |
|---|---|---|---|
| 1 | 기능 범위 | ... | ... |
| 2 | AC 완결성 | ... | ... |
```

- 미해소 항목은 `[미결]` 표시
- 결정된 항목은 해당 AC / Brief에도 반영
- starter doctor fails unresolved `[NEEDS CLARIFICATION:]` markers in the active issue; blocking ambiguity must be resolved before `/pokit.issue` execution.

## Depth Rule (grill-me 계약)

답변이 모호하면 같은 영역을 다시 질문한다.
"잘 모르겠다"는 답변은 `[미결]`로 기록하고 다음으로 넘어간다.
모든 5개 질문이 해소되거나 `[미결]` 처리될 때까지 진행한다.

## Natural Language First-Class Rule

`/pokit.clarify` 명령 없이 자연어로 요청해도 동일한 명확화가 수행된다.
이 템플릿은 명시적 명령의 계약을 정의할 뿐이며, 자연어 경로를 우선하거나 강제하지 않는다.

## Reference

품질 기준 및 섹션 적용 규칙: `.ai-os/standards/issue-quality.md`

## Runtime Boundary

이 파일은 runtime-agnostic markdown 원본이다.
Claude Code native slash command는 별도 B5 (generate-at-install) 단계에서 `.claude/commands/pokit.clarify.md`로 생성된다.
Codex / Antigravity 어댑터는 v0.7 POK-118 범위다.

<!-- starter:begin -->
# /pokit.clarify

Use this command when an issue has unclear scope, vague acceptance criteria, or unresolved decisions.

Recommended flow:

1. Read `.ai-os/current.md`.
2. Mark unclear requirements with `[NEEDS CLARIFICATION:]`.
3. Ask the smallest useful question set.
4. Update the issue only after the answer is clear.
5. Run `node scripts/pokit-doctor.mjs`.

The starter doctor fails unresolved `[NEEDS CLARIFICATION:]` markers in the active issue, so use the marker only for ambiguity that must be resolved before execution.

Clarification work reduces ambiguity before execution starts.

Public contract tokens: `pokit.clarify`, `pokit.backlog`, `pokit.issue`, `[NEEDS CLARIFICATION:]`, `Verification`, `gate evidence`.

Use `pokit.backlog` for approved definition changes and return to `pokit.issue` only after blocking ambiguity is resolved.
<!-- starter:end -->
